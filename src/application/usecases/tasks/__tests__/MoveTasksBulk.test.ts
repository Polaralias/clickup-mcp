import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { moveTasksBulk } from "../MoveTasksBulk.js"

describe("moveTasksBulk", () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>
  const config: ApplicationConfig = {
    teamId: "team-1",
    apiKey: "token",
    charLimit: 10_000,
    maxAttachmentMb: 8
  }

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

  it("surfaces per-task results including failures", async () => {
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

    const result = await moveTasksBulk(
      {
        confirm: "yes",
        dryRun: false,
        defaults: { listId: "list-123" },
        tasks: [{ taskId: "task-123" }, { taskId: "task-456" }]
      },
      client,
      config
    )

    fetchMock.mock.calls.forEach(([, init]) => {
      expect(init?.method).toBe("PUT")
      expect(init?.body).toBeDefined()
    })
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failedIndices).toEqual([1])
    expect(result.results[0]).toMatchObject({
      index: 0,
      taskId: "task-123",
      listId: "list-123",
      status: "moved"
    })
    expect(result.results[1]).toMatchObject({
      index: 1,
      taskId: "task-456",
      listId: "list-123",
      error: "ClickUp 500: boom"
    })
  })
})
