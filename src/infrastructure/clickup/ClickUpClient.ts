const BASE_URL = "https://api.clickup.com/api/v2"
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
    return this.request("/team")
  }

  listSpaces(workspaceId: string) {
    return this.request(`/team/${workspaceId}/space`)
  }

  listFolders(spaceId: string) {
    return this.request(`/space/${spaceId}/folder`)
  }

  listLists(spaceId: string, folderId?: string) {
    if (folderId) {
      return this.request(`/folder/${folderId}/list`)
    }
    return this.request(`/space/${spaceId}/list`)
  }

  listTagsForSpace(spaceId: string) {
    return this.request(`/space/${spaceId}/tag`)
  }

  getWorkspaceOverview(workspaceId: string) {
    return this.request(`/team/${workspaceId}`)
  }

  listMembers(teamId?: string) {
    if (teamId) {
      return this.request(`/team/${teamId}/member`)
    }
    return this.request(`/team`)
  }

  resolveMembers(teamId: string) {
    return this.request(`/team/${teamId}/member`)
  }

  searchTasks(teamId: string, query: Record<string, unknown>) {
    return this.request(`/team/${teamId}/task`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  createTask(listId: string, body: Record<string, unknown>) {
    return this.request(`/list/${listId}/task`, {
      method: "POST",
      body
    })
  }

  updateTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`/task/${taskId}`, {
      method: "PUT",
      body
    })
  }

  deleteTask(taskId: string) {
    return this.request(`/task/${taskId}`, {
      method: "DELETE"
    })
  }

  moveTask(taskId: string, listId: string) {
    return this.request(`/task/${taskId}/list/${listId}`, {
      method: "POST"
    })
  }

  duplicateTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`/task/${taskId}/duplicate`, {
      method: "POST",
      body
    })
  }

  commentTask(taskId: string, body: Record<string, unknown>) {
    return this.request(`/task/${taskId}/comment`, {
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
    return this.request(`/task/${taskId}/tag`, {
      method: "POST",
      body: { tags }
    })
  }

  removeTags(taskId: string, tags: string[]) {
    return this.request(`/task/${taskId}/tag`, {
      method: "DELETE",
      body: { tags }
    })
  }

  createDoc(folderId: string, body: Record<string, unknown>) {
    return this.request(`/folder/${folderId}/doc`, {
      method: "POST",
      body
    })
  }

  listDocPages(docId: string) {
    return this.request(`/doc/${docId}/page`)
  }

  getDocPage(docId: string, pageId: string) {
    return this.request(`/doc/${docId}/page/${pageId}`)
  }

  updateDocPage(docId: string, pageId: string, body: Record<string, unknown>) {
    return this.request(`/doc/${docId}/page/${pageId}`, {
      method: "PUT",
      body
    })
  }

  searchDocs(teamId: string, query: Record<string, unknown>) {
    return this.request(`/team/${teamId}/doc`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  startTimer(taskId: string) {
    return this.request(`/task/${taskId}/time`, {
      method: "POST",
      body: { start: Date.now() }
    })
  }

  stopTimer(taskId: string) {
    return this.request(`/task/${taskId}/time`, {
      method: "POST",
      body: { end: Date.now() }
    })
  }

  createTimeEntry(taskId: string, body: Record<string, unknown>) {
    return this.request(`/task/${taskId}/time`, {
      method: "POST",
      body
    })
  }

  updateTimeEntry(entryId: string, body: Record<string, unknown>) {
    return this.request(`/time_entry/${entryId}`, {
      method: "PUT",
      body
    })
  }

  deleteTimeEntry(entryId: string) {
    return this.request(`/time_entry/${entryId}`, {
      method: "DELETE"
    })
  }

  listTimeEntries(teamId: string, query: Record<string, unknown>) {
    return this.request(`/team/${teamId}/time_entries`, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }

  reportTime(path: string, query: Record<string, unknown>) {
    return this.request(path, {
      method: "GET",
      searchParams: query as Record<string, string>
    })
  }
}
