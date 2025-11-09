import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ClickUpClient } from "../ClickUpClient.js"

describe("ClickUpClient authorization header", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () =>
      new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    )
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function getAuthorizationHeader() {
    const [, init] = fetchMock.mock.calls.at(-1) as [RequestInfo, RequestInit]
    return (init.headers as Record<string, string>).Authorization
  }

  it("adds a Bearer prefix when the token appears to be an OAuth access token", async () => {
    const client = new ClickUpClient("oauth-access-token")

    await client.listWorkspaces()

    expect(getAuthorizationHeader()).toBe("Bearer oauth-access-token")
  })

  it("keeps an explicit Bearer scheme when provided", async () => {
    const client = new ClickUpClient("Bearer already-prefixed")

    await client.listWorkspaces()

    expect(getAuthorizationHeader()).toBe("Bearer already-prefixed")
  })

  it("sends personal API tokens without modification", async () => {
    const client = new ClickUpClient("pk_12345")

    await client.listWorkspaces()

    expect(getAuthorizationHeader()).toBe("pk_12345")
  })
})
