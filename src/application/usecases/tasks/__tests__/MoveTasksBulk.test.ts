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

  it("moves each task using the POST list endpoint", async () => {
    const client = new ClickUpClient("token")

    const result = await moveTasksBulk(
      {
        confirm: "yes",
        dryRun: false,
        defaults: { listId: "list-123" },
        tasks: [{ taskId: "task-123" }]
      },
      client,
      config
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain("/task/task-123/list/list-123")
    expect(init?.method).toBe("POST")
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(0)
  })
})
