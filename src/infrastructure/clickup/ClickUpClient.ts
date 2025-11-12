const BASE_URL = "https://api.clickup.com/api/v2/"
const RETRY_STATUS = new Set([429, 500, 502, 503, 504])

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ParsedClickUpError = {
  status?: number
  body?: unknown
}

type SearchParamPrimitive = string | number | boolean
type SearchParamValue = SearchParamPrimitive | SearchParamPrimitive[] | undefined
export type SearchParams = Record<string, SearchParamValue>

function parseClickUpError(error: Error): ParsedClickUpError | undefined {
  const match = error.message.match(/^ClickUp (\d+):\s*(.+)$/s)
  if (!match) {
    return undefined
  }

  const status = Number.parseInt(match[1], 10)
  const rawBody = match[2]
  let parsedBody: unknown = rawBody

  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    parsedBody = rawBody
  }

  return { status, body: parsedBody }
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return "Unknown error"
  }
}

function extractErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") {
    return undefined
  }

  const withErr = body as { err?: { code?: string }; code?: string }
  if (withErr.err?.code) {
    return withErr.err.code
  }

  return withErr.code
}

function normaliseId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value
  }
  if (typeof value === "number") {
    return String(value)
  }
  return undefined
}

export class ClickUpMembersFallbackError extends Error {
  readonly teamId: string
  readonly cause?: unknown

  constructor(teamId: string, message = `ClickUp fallback member lookup failed for workspace ${teamId}`, options?: { cause?: unknown }) {
    super(message)
    this.name = "ClickUpMembersFallbackError"
    this.teamId = teamId
    this.cause = options?.cause
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  searchParams?: SearchParams
  headers?: Record<string, string>
}

export type MoveTaskBulkOutcome =
  | { success: true; taskId: string; listId: string }
  | { success: false; taskId: string; listId: string; error: string }

export class ClickUpClient {
  constructor(private readonly token: string) {
    if (!this.token) {
      throw new Error("CLICKUP_API_TOKEN is required")
    }
  }

  private async request(path: string, options: RequestOptions = {}, attempt = 0): Promise<any> {
    const url = new URL(path, BASE_URL)
    if (options.searchParams) {
      Object.entries(options.searchParams).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return
        }
        if (Array.isArray(value)) {
          const paramKey = key.endsWith("[]") ? key : `${key}[]`
          value.forEach((entry) => {
            if (entry !== undefined && entry !== null) {
              url.searchParams.append(paramKey, String(entry))
            }
          })
          return
        }
        url.searchParams.set(key, String(value))
      })
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: this.token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    if (!response.ok) {
      if (RETRY_STATUS.has(response.status) && attempt < 3) {
        await delay(2 ** attempt * 250)
        return this.request(path, options, attempt + 1)
      }
      const errorBody = await response.text()
      throw new Error(`ClickUp ${response.status}: ${errorBody}`)
    }

    if (response.status === 204) {
      return null
    }

    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return response.json()
    }
    return response.text()
  }

  listWorkspaces() {
    return this.request("team")
  }

  listSpaces(workspaceId: string) {
    return this.request(`team/${workspaceId}/space`)
  }

  listFolders(spaceId: string) {
    return this.request(`space/${spaceId}/folder`)
  }

  listLists(spaceId: string, folderId?: string) {
    if (folderId) {
      return this.request(`folder/${folderId}/list`)
    }
    return this.request(`space/${spaceId}/list`)
  }

  createFolder(spaceId: string, body: Record<string, unknown>) {
    return this.request(`space/${spaceId}/folder`, {
      method: "POST",
      body
    })
  }

  updateFolder(folderId: string, body: Record<string, unknown>) {
    return this.request(`folder/${folderId}`, {
      method: "PUT",
      body
    })
  }

  deleteFolder(folderId: string) {
    return this.request(`folder/${folderId}`, {
      method: "DELETE"
    })
  }

  createListInSpace(spaceId: string, body: Record<string, unknown>) {
    return this.request(`space/${spaceId}/list`, {
      method: "POST",
      body
    })
  }

  createListInFolder(folderId: string, body: Record<string, unknown>) {
    return this.request(`folder/${folderId}/list`, {
      method: "POST",
      body
    })
  }

  updateList(listId: string, body: Record<string, unknown>) {
    return this.request(`list/${listId}`, {
      method: "PUT",
      body
    })
  }

  deleteList(listId: string) {
    return this.request(`list/${listId}`, {
      method: "DELETE"
    })
  }

  createListView(listId: string, body: Record<string, unknown>) {
    return this.request(`list/${listId}/view`, {
      method: "POST",
      body
    })
  }

  createSpaceView(spaceId: string, body: Record<string, unknown>) {
    return this.request(`space/${spaceId}/view`, {
      method: "POST",
      body
    })
  }

  updateView(viewId: string, body: Record<string, unknown>) {
    return this.request(`view/${viewId}`, {
      method: "PUT",
      body
    })
  }

  deleteView(viewId: string) {
    return this.request(`view/${viewId}`, {
      method: "DELETE"
    })
  }

  listTagsForSpace(spaceId: string) {
    return this.request(`space/${spaceId}/tag`)
  }

  createSpaceTag(spaceId: string, body: Record<string, unknown>) {
    return this.request(`space/${spaceId}/tag`, {
      method: "POST",
      body
    })
  }

  updateSpaceTag(spaceId: string, tagName: string, body: Record<string, unknown>) {
    return this.request(`space/${spaceId}/tag/${encodeURIComponent(tagName)}`, {
      method: "PUT",
      body
    })
  }

  deleteSpaceTag(spaceId: string, tagName: string) {
    return this.request(`space/${spaceId}/tag/${encodeURIComponent(tagName)}`, {
      method: "DELETE"
    })
  }

  async listMembers(teamId?: string) {
    if (!teamId) {
      return this.request("team")
    }

    try {
      return await this.request(`team/${teamId}/member`)
    } catch (error) {
      if (!this.shouldFallbackToTeamListing(error)) {
        throw error
      }

      try {
        return await this.listMembersViaTeamListing(teamId)
      } catch (fallbackError) {
        throw new ClickUpMembersFallbackError(teamId, undefined, { cause: fallbackError })
      }
    }
  }

  private shouldFallbackToTeamListing(error: unknown) {
    if (!(error instanceof Error)) {
      return false
    }

    const parsed = parseClickUpError(error)
    if (!parsed || parsed.status !== 404) {
      return false
    }

    return extractErrorCode(parsed.body) === "APP_001"
  }

  private async listMembersViaTeamListing(teamId: string) {
    const response = await this.request("team")
    const teams = this.extractTeams(response)
    const targetId = teamId.trim()
    const team = teams.find((entry) => this.teamMatches(entry, targetId))

    if (!team) {
      throw new Error(`Workspace ${targetId} was not present in /team response`)
    }

    const members = Array.isArray((team as { members?: unknown[] }).members) ? (team as { members: unknown[] }).members : []
    return { members }
  }

  private extractTeams(response: unknown) {
    if (Array.isArray(response)) {
      return response
    }

    if (response && typeof response === "object") {
      const withTeams = response as { teams?: unknown; data?: unknown }
      if (Array.isArray(withTeams.teams)) {
        return withTeams.teams
      }
      if (Array.isArray(withTeams.data)) {
        return withTeams.data
      }
    }

    return []
  }

  private teamMatches(entry: unknown, teamId: string) {
    if (!entry || typeof entry !== "object") {
      return false
    }

    const candidate = entry as { id?: unknown; team_id?: unknown; teamId?: unknown }
    const matchers = [candidate.id, candidate.team_id, candidate.teamId]
    return matchers.some((value) => normaliseId(value) === teamId)
  }

  resolveMembers(teamId: string) {
    return this.request(`team/${teamId}/member`)
  }

  searchTasks(teamId: string, query: SearchParams) {
    return this.request(`team/${teamId}/task`, {
      method: "GET",
      searchParams: query
    })
  }

  getTask(taskId: string) {
    return this.request(`task/${taskId}`)
  }

  listTasksInList(listId: string, query: SearchParams = {}) {
    return this.request(`list/${listId}/task`, {
      method: "GET",
      searchParams: query
    })
  }

  listTaskComments(taskId: string) {
    return this.request(`task/${taskId}/comment`)
  }

  createTask(listId: string, body: Record<string, unknown>) {
    return this.request(`list/${listId}/task`, {
      method: "POST",
      body
    })
  }

  updateTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`task/${taskId}`, {
      method: "PUT",
      body
    })
  }

  deleteTask(taskId: string) {
    return this.request(`task/${taskId}`, {
      method: "DELETE"
    })
  }

  async moveTask(taskId: string, listId: string) {
    try {
      return await this.request(`task/${taskId}`, {
        method: "PUT",
        body: { list: listId }
      })
    } catch (error) {
      const parsed = error instanceof Error ? parseClickUpError(error) : undefined
      if (parsed?.status === 404) {
        console.warn(
          "ClickUp moveTask PUT returned 404. Falling back to deprecated POST /task/{taskId}/list/{listId}."
        )
        return this.request(`task/${taskId}/list/${listId}`, {
          method: "POST"
        })
      }
      throw error
    }
  }

  duplicateTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`task/${taskId}/duplicate`, {
      method: "POST",
      body
    })
  }

  commentTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`task/${taskId}/comment`, {
      method: "POST",
      body
    })
  }

  attachFile(taskId: string, formData: FormData) {
    return fetch(`${BASE_URL}/task/${taskId}/attachment`, {
      method: "POST",
      headers: {
        Authorization: this.token
      },
      body: formData
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`ClickUp ${response.status}`)
      }
      return response.json()
    })
  }

  addTags(taskId: string, tags: string[]) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return Promise.resolve([] as unknown[])
    }
    return Promise.all(
      tags.map((tag) =>
        this.request(`task/${taskId}/tag/${encodeURIComponent(tag)}`, {
          method: "POST"
        })
      )
    )
  }

  removeTags(taskId: string, tags: string[]) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return Promise.resolve([] as unknown[])
    }
    return Promise.all(
      tags.map((tag) =>
        this.request(`task/${taskId}/tag/${encodeURIComponent(tag)}`, {
          method: "DELETE"
        })
      )
    )
  }

  createTasksBulk(teamId: string, tasks: Array<Record<string, unknown>>) {
    return this.request(`task/bulk`, {
      method: "POST",
      searchParams: { team_id: teamId },
      body: { tasks }
    })
  }

  updateTasksBulk(teamId: string, tasks: Array<Record<string, unknown>>) {
    return this.request(`task/bulk`, {
      method: "PUT",
      searchParams: { team_id: teamId },
      body: { tasks }
    })
  }

  async moveTasksBulk(
    moves: Array<{ taskId: string; listId: string }>,
    options: { concurrency?: number } = {}
  ): Promise<MoveTaskBulkOutcome[]> {
    if (moves.length === 0) {
      return []
    }

    const limit = Math.max(1, options.concurrency ?? 5)
    const results: MoveTaskBulkOutcome[] = new Array(moves.length)
    let pointer = 0

    const worker = async () => {
      while (true) {
        const index = pointer
        if (index >= moves.length) {
          return
        }
        pointer += 1
        const move = moves[index]
        try {
          await this.moveTask(move.taskId, move.listId)
          results[index] = { success: true as const, taskId: move.taskId, listId: move.listId }
        } catch (error) {
          results[index] = {
            success: false as const,
            taskId: move.taskId,
            listId: move.listId,
            error: formatUnknownError(error)
          }
        }
      }
    }

    const workers = Array.from({ length: Math.min(limit, moves.length) }, () => worker())
    await Promise.all(workers)
    return results
  }

  deleteTasksBulk(teamId: string, taskIds: string[]) {
    return this.request(`task/bulk`, {
      method: "DELETE",
      searchParams: { team_id: teamId },
      body: { task_ids: taskIds }
    })
  }

  addTagsBulk(teamId: string, operations: Array<Record<string, unknown>>) {
    return this.request(`task/tag/bulk`, {
      method: "POST",
      searchParams: { team_id: teamId },
      body: { operations }
    })
  }

  createDoc(folderId: string, body: Record<string, unknown>) {
    return this.request(`folder/${folderId}/doc`, {
      method: "POST",
      body
    })
  }

  listDocuments(workspaceId: string, filters: Record<string, string | number | boolean | undefined> = {}) {
    return this.request(`team/${workspaceId}/doc`, {
      method: "GET",
      searchParams: filters
    })
  }

  getDocument(workspaceId: string, docId: string) {
    return this.request(`team/${workspaceId}/doc/${docId}`)
  }

  listDocPages(docId: string) {
    return this.request(`doc/${docId}/page`)
  }

  bulkGetDocumentPages(docId: string, pageIds: string[]) {
    return this.request(`doc/${docId}/page/bulk`, {
      method: "POST",
      body: { page_ids: pageIds }
    })
  }

  createDocumentPage(docId: string, body: Record<string, unknown>) {
    return this.request(`doc/${docId}/page`, {
      method: "POST",
      body
    })
  }

  getDocPage(docId: string, pageId: string) {
    return this.request(`doc/${docId}/page/${pageId}`)
  }

  updateDocPage(docId: string, pageId: string, body: Record<string, unknown>) {
    return this.request(`doc/${docId}/page/${pageId}`, {
      method: "PUT",
      body
    })
  }

  searchDocs(teamId: string, query: Record<string, unknown>) {
    return this.request(`team/${teamId}/doc`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  startTimer(taskId: string) {
    return this.request(`task/${taskId}/time`, {
      method: "POST",
      body: { start: Date.now() }
    })
  }

  stopTimer(taskId: string) {
    return this.request(`task/${taskId}/time`, {
      method: "POST",
      body: { end: Date.now() }
    })
  }

  createTimeEntry(taskId: string, body: Record<string, unknown>) {
    return this.request(`task/${taskId}/time`, {
      method: "POST",
      body
    })
  }

  getTaskTimeEntries(taskId: string) {
    return this.request(`task/${taskId}/time`)
  }

  updateTimeEntry(teamId: string, entryId: string, body: Record<string, unknown>) {
    return this.request(`team/${teamId}/time_entries/${entryId}`, {
      method: "PUT",
      body
    })
  }

  deleteTimeEntry(teamId: string, entryId: string) {
    return this.request(`team/${teamId}/time_entries/${entryId}`, {
      method: "DELETE"
    })
  }

  listTimeEntries(teamId: string, query: SearchParams) {
    return this.request(`team/${teamId}/time_entries`, {
      method: "GET",
      searchParams: query
    })
  }

  getCurrentTimeEntry(teamId: string) {
    return this.request(`team/${teamId}/time_entries/current`)
  }

  reportTime(path: string, query: SearchParams) {
    return this.request(path, {
      method: "GET",
      searchParams: query
    })
  }
}
