import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { ClickUpClient, ClickUpMembersFallbackError } from "../ClickUpClient.js"

describe("ClickUpClient", () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: vi.fn(),
      json: vi.fn()
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("serialises array search params using bracket notation", async () => {
    const client = new ClickUpClient("token")

    await client.searchTasks("team-123", {
      statuses: ["open", "closed"],
      list_ids: "abc123"
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    const actual = new URL(String(url))
    expect(actual.searchParams.getAll("statuses[]")).toEqual(["open", "closed"])
    expect(actual.searchParams.get("list_ids")).toBe("abc123")
  })

  it("uses PUT when moving a task", async () => {
    const client = new ClickUpClient("token")

    await client.moveTask("task-123", "list-456")

    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe("PUT")
    expect(init?.body).toBe(JSON.stringify({ list: "list-456" }))
  })

  it("falls back to POST when PUT is not available", async () => {
    const client = new ClickUpClient("token")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ message: "not found" })),
        json: vi.fn()
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: vi.fn(),
        json: vi.fn()
      })

    await client.moveTask("task-123", "list-456")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [firstUrl, firstInit] = fetchMock.mock.calls[0]
    expect(String(firstUrl)).toContain("/task/task-123")
    expect(firstInit?.method).toBe("PUT")
    const [secondUrl, secondInit] = fetchMock.mock.calls[1]
    expect(String(secondUrl)).toContain("/task/task-123/list/list-456")
    expect(secondInit?.method).toBe("POST")
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Falling back to deprecated POST")
    )
  })

  it("moves multiple tasks via per-task PUT requests", async () => {
    const client = new ClickUpClient("token")

    const makeFailureResponse = () => ({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("boom"),
      json: vi.fn()
    })
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
        text: vi.fn(),
        json: vi.fn()
      })
      .mockResolvedValueOnce(makeFailureResponse())
      .mockResolvedValueOnce(makeFailureResponse())
      .mockResolvedValueOnce(makeFailureResponse())
      .mockResolvedValueOnce(makeFailureResponse())

    const results = await client.moveTasksBulk([
      { taskId: "task-1", listId: "list-1" },
      { taskId: "task-2", listId: "list-2" }
    ])

    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calledUrls.filter((url) => url.endsWith("/task/task-1"))).toHaveLength(1)
    expect(calledUrls.filter((url) => url.endsWith("/task/task-2")).length).toBeGreaterThanOrEqual(1)
    const methods = fetchMock.mock.calls.map(([, init]) => init?.method)
    expect(methods.every((method) => method === "PUT")).toBe(true)
    expect(results).toEqual([
      { success: true, taskId: "task-1", listId: "list-1" },
      {
        success: false,
        taskId: "task-2",
        listId: "list-2",
        error: "ClickUp 500: boom"
      }
    ])
  })

  it("hits the member listing endpoint", async () => {
    const client = new ClickUpClient("token")

    await client.listMembers("123")

    expect(fetchMock).toHaveBeenCalled()
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/team/123/member")
  })

  it("falls back to workspace listing when member endpoint returns APP_001", async () => {
    const client = new ClickUpClient("token")

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ err: { code: "APP_001" } })),
        json: vi.fn()
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ teams: [{ id: "123", members: [{ id: "member-1" }] }] }),
        text: vi.fn()
      })

    const result = await client.listMembers("123")

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ members: [{ id: "member-1" }] })
  })

  it("throws a descriptive error when the fallback cannot find the workspace", async () => {
    const client = new ClickUpClient("token")

    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers({ "content-type": "application/json" }),
        text: vi.fn().mockResolvedValue(JSON.stringify({ err: { code: "APP_001" } })),
        json: vi.fn()
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ teams: [] }),
        text: vi.fn()
      })

    await expect(client.listMembers("123")).rejects.toBeInstanceOf(ClickUpMembersFallbackError)
  })

  it("adds tags using per-tag endpoints", async () => {
    const client = new ClickUpClient("token")

    await client.addTags("task-123", ["alpha", "beta"])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calledUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(calledUrls).toContain("https://api.clickup.com/api/v2/task/task-123/tag/alpha")
    expect(calledUrls).toContain("https://api.clickup.com/api/v2/task/task-123/tag/beta")
    fetchMock.mockClear()

    await client.addTags("task-123", [])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("removes tags using per-tag endpoints", async () => {
    const client = new ClickUpClient("token")

    await client.removeTags("task-123", ["alpha"])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/task/task-123/tag/alpha")
    expect(init?.method).toBe("DELETE")
  })

  it("updates time entries with team scoped endpoint", async () => {
    const client = new ClickUpClient("token")

    await client.updateTimeEntry("321", "timer-1", { duration: 1000 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/team/321/time_entries/timer-1")
    expect(init?.method).toBe("PUT")
  })

  it("deletes time entries with team scoped endpoint", async () => {
    const client = new ClickUpClient("token")

    await client.deleteTimeEntry("321", "timer-1")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/team/321/time_entries/timer-1")
    expect(init?.method).toBe("DELETE")
  })
})
