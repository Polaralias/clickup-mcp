const BASE_URL = "https://api.clickup.com/api/v2/"
const BASE_URL_V3 = "https://api.clickup.com/api/v3/"
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

export type ClickUpMemberListing = {
  members: unknown[]
  source: "direct" | "fallback"
  raw?: unknown
  diagnostics?: string
}

function parseClickUpError(error: unknown): ParsedClickUpError | undefined {
  if (error instanceof ClickUpRequestError) {
    return { status: error.statusCode, body: error.upstream.body }
  }

  if (!(error instanceof Error)) {
    return undefined
  }

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

function extractErrorMessage(body: unknown): string | undefined {
  if (!body) {
    return undefined
  }

  if (typeof body === "string") {
    return body
  }

  if (typeof body === "object") {
    const candidate = body as { err?: { message?: string }; message?: string; error?: string }
    return candidate.err?.message ?? candidate.message ?? candidate.error
  }

  return undefined
}

function serialiseForHint(body: unknown): string | undefined {
  if (body === undefined || body === null) {
    return undefined
  }

  if (typeof body === "string") {
    return body
  }

  if (typeof body === "object") {
    try {
      return JSON.stringify(body)
    } catch {
      return undefined
    }
  }

  return String(body)
}

function deriveHint({
  path,
  statusCode,
  body
}: {
  path: string
  statusCode: number
  body: unknown
}): string | undefined {
  const bodyText = serialiseForHint(body)?.toLowerCase() ?? ""
  const messageText = extractErrorMessage(body)?.toLowerCase() ?? bodyText

  if (
    statusCode === 400 &&
    (bodyText.includes("statuses") || messageText.includes("statuses"))
  ) {
    return "ClickUp expects the statuses[] query parameter to be an array of status names. Provide statuses[] entries instead of a single value."
  }

  if (
    statusCode === 400 &&
    /time/.test(path) &&
    (bodyText.includes("date") || messageText.includes("date") || messageText.includes("time"))
  ) {
    return "Check the start and end timestamps sent to ClickUp. Provide ISO 8601 strings or epoch milliseconds in the workspace timezone."
  }

  if (
    statusCode === 404 &&
    (/\/docs?\b/.test(path) || /\/view\b/.test(path) || path.includes("capability"))
  ) {
    return "This ClickUp workspace may not support that capability. Use the capability tools to confirm availability or upgrade the workspace plan."
  }

  return undefined
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

function truncate(value: string, maxLength = 400) {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, maxLength)}…`
}

export type ClickUpErrorUpstream = {
  statusCode: number
  body: unknown
  rawBody: string
  headers: Record<string, string>
  request: {
    method: string
    path: string
  }
}

export type ClickUpRequestErrorShape = {
  statusCode: number
  ecode?: string
  message: string
  hint?: string
  upstream: ClickUpErrorUpstream
}

export class ClickUpRequestError extends Error implements ClickUpRequestErrorShape {
  readonly statusCode: number
  readonly ecode?: string
  readonly hint?: string
  readonly upstream: ClickUpErrorUpstream

  constructor({ statusCode, ecode, message, hint, upstream }: ClickUpRequestErrorShape) {
    super(message)
    this.name = "ClickUpRequestError"
    this.statusCode = statusCode
    this.ecode = ecode
    this.hint = hint
    this.upstream = upstream
  }

  toJSON(): ClickUpRequestErrorShape {
    return {
      statusCode: this.statusCode,
      ecode: this.ecode,
      message: this.message,
      hint: this.hint,
      upstream: this.upstream
    }
  }
}

export type NormalisedClickUpError = {
  statusCode?: number
  ecode?: string
  message: string
  hint?: string
  upstream?: ClickUpErrorUpstream
}

export function normaliseClickUpError(error: unknown): NormalisedClickUpError {
  if (error instanceof ClickUpRequestError) {
    return error.toJSON()
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      statusCode?: number
      ecode?: string
      message?: string
      hint?: string
      upstream?: ClickUpErrorUpstream
    }
    if (typeof candidate.message === "string") {
      return {
        statusCode: candidate.statusCode,
        ecode: candidate.ecode,
        message: candidate.message,
        hint: candidate.hint,
        upstream: candidate.upstream
      }
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  if (typeof error === "string") {
    return { message: error }
  }

  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: "Unknown error" }
  }
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

export class ClickUpClient {
  constructor(private readonly token: string) {
    if (!this.token) {
      throw new Error("CLICKUP_API_TOKEN is required")
    }
  }

  private async requestWithBase(
    path: string,
    baseUrl: string,
    options: RequestOptions = {},
    attempt = 0
  ): Promise<any> {
    const url = new URL(path, baseUrl)
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

    const method = options.method ?? "GET"

    const response = await fetch(url, {
      method,
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
        return this.requestWithBase(path, baseUrl, options, attempt + 1)
      }
      const rawBody = await response.text()
      let parsedBody: unknown = rawBody

      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody)
        } catch {
          parsedBody = rawBody
        }
      }

      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })
      const statusCode = response.status
      const message = `ClickUp ${statusCode}: ${rawBody}`
      const ecode = extractErrorCode(parsedBody)
      const hint = deriveHint({ path, statusCode, body: parsedBody })

      throw new ClickUpRequestError({
        statusCode,
        ecode,
        message,
        hint,
        upstream: {
          statusCode,
          body: parsedBody,
          rawBody,
          headers,
          request: { method, path }
        }
      })
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

  private request(path: string, options: RequestOptions = {}, attempt = 0) {
    return this.requestWithBase(path, BASE_URL, options, attempt)
  }

  private requestV3(path: string, options: RequestOptions = {}, attempt = 0) {
    return this.requestWithBase(path, BASE_URL_V3, options, attempt)
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
      const response = await this.request(`team/${teamId}/member`)
      return this.buildMemberListing(response, "direct")
    } catch (error) {
      const fallback = this.extractFallbackContext(error)
      if (!fallback) {
        throw error
      }

      try {
        const fallbackResult = await this.listMembersViaTeamListing(teamId)
        return this.buildMemberListing(fallbackResult.raw, "fallback", fallback.diagnostics)
      } catch (fallbackError) {
        throw new ClickUpMembersFallbackError(teamId, undefined, { cause: fallbackError })
      }
    }
  }

  private extractFallbackContext(error: unknown): { diagnostics?: string } | undefined {
    if (!(error instanceof Error)) {
      return undefined
    }

    const parsed = parseClickUpError(error)
    if (parsed?.status === 404) {
      return { diagnostics: this.formatFallbackDiagnostics(parsed.status, parsed.body) }
    }

    if (error.message.includes("ClickUp 404")) {
      return { diagnostics: truncate(error.message) }
    }

    return undefined
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
    return { members, raw: team }
  }

  private buildMemberListing(raw: unknown, source: "direct" | "fallback", diagnostics?: string): ClickUpMemberListing {
    const members = this.extractMembers(raw)
    const listing: ClickUpMemberListing = { members, source, raw }
    if (diagnostics) {
      listing.diagnostics = diagnostics
    }
    return listing
  }

  private extractMembers(response: unknown) {
    if (Array.isArray((response as { members?: unknown[] } | undefined)?.members)) {
      return ((response as { members?: unknown[] }).members ?? []) as unknown[]
    }

    if (Array.isArray(response)) {
      return response as unknown[]
    }

    return []
  }

  private formatFallbackDiagnostics(status?: number, body?: unknown) {
    const parts: string[] = []

    if (typeof status === "number") {
      parts.push(`status=${status}`)
    }

    const code = extractErrorCode(body)
    if (code) {
      parts.push(`code=${code}`)
    }

    const snippet = this.serialiseBody(body)
    if (snippet) {
      parts.push(`body=${snippet}`)
    }

    return parts.length > 0 ? parts.join(" ") : undefined
  }

  private serialiseBody(body: unknown) {
    if (body === undefined || body === null) {
      return undefined
    }

    if (typeof body === "string") {
      return truncate(body)
    }

    if (typeof body === "object") {
      try {
        return truncate(JSON.stringify(body))
      } catch {
        return "[unserializable body]"
      }
    }

    return truncate(String(body))
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

  createDoc(workspaceId: string, body: Record<string, unknown>) {
    return this.requestV3(`workspaces/${workspaceId}/docs`, {
      method: "POST",
      body
    })
  }

  listDocuments(workspaceId: string, filters: Record<string, string | number | boolean | undefined> = {}) {
    return this.requestV3(`workspaces/${workspaceId}/docs`, {
      method: "GET",
      searchParams: filters
    })
  }

  getDocument(workspaceId: string, docId: string) {
    return this.requestV3(`workspaces/${workspaceId}/docs/${docId}`)
  }

  listDocPages(docId: string) {
    return this.requestV3(`docs/${docId}/page_listing`)
  }

  bulkGetDocumentPages(docId: string, pageIds: string[]) {
    return this.requestV3(`docs/${docId}/pages/bulk`, {
      method: "POST",
      body: { page_ids: pageIds }
    })
  }

  createDocumentPage(docId: string, body: Record<string, unknown>) {
    return this.requestV3(`docs/${docId}/pages`, {
      method: "POST",
      body
    })
  }

  getDocPage(docId: string, pageId: string) {
    return this.requestV3(`docs/${docId}/pages/${pageId}`)
  }

  updateDocPage(docId: string, pageId: string, body: Record<string, unknown>) {
    return this.requestV3(`docs/${docId}/pages/${pageId}`, {
      method: "PUT",
      body
    })
  }

  searchDocs(teamId: string, query: Record<string, unknown>) {
    return this.requestV3(`workspaces/${teamId}/docs`, {
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
