import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { ClickUpClient } from "../ClickUpClient.js"

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

  it("uses PUT when moving a task", async () => {
    const client = new ClickUpClient("token")

    await client.moveTask("task-123", "list-456")

    expect(fetchMock).toHaveBeenCalled()
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe("PUT")
  })
})
