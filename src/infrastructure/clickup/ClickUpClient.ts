const BASE_URL = "https://api.clickup.com/api/v2/"
const RETRY_STATUS = new Set([429, 500, 502, 503, 504])

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type RequestOptions = {
  method?: string
  body?: unknown
  searchParams?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

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
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
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

  listMembers(teamId?: string) {
    if (teamId) {
      return this.request(`team/${teamId}/member`)
    }
    return this.request("team")
  }

  resolveMembers(teamId: string) {
    return this.request(`team/${teamId}/member`)
  }

  searchTasks(teamId: string, query: Record<string, unknown>) {
    return this.request(`team/${teamId}/task`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  getTask(taskId: string) {
    return this.request(`task/${taskId}`)
  }

  listTasksInList(listId: string, query: Record<string, unknown> = {}) {
    return this.request(`list/${listId}/task`, {
      method: "GET",
      searchParams: query as Record<string, string | number | boolean | undefined>
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

  moveTask(taskId: string, listId: string) {
    return this.request(`task/${taskId}/list/${listId}`, {
      method: "POST"
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

  moveTasksBulk(teamId: string, moves: Array<Record<string, unknown>>) {
    return this.request(`task/move/bulk`, {
      method: "POST",
      searchParams: { team_id: teamId },
      body: { tasks: moves }
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

  listTimeEntries(teamId: string, query: Record<string, unknown>) {
    return this.request(`team/${teamId}/time_entries`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  getCurrentTimeEntry(teamId: string) {
    return this.request(`team/${teamId}/time_entries/current`)
  }

  reportTime(path: string, query: Record<string, unknown>) {
    return this.request(path, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }
}
