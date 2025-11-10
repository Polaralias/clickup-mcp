import { beforeEach, describe, expect, it, vi } from "vitest"
import { ClickUpClient } from "../ClickUpClient.js"

describe("ClickUpClient", () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  const createMockResponse = (data: any) => ({
    ok: true,
    status: 200,
    headers: new Headers({
      "content-type": "application/json"
    }),
    json: vi.fn().mockResolvedValue(data)
  })

  describe("authentication header format", () => {
    it("uses token directly for Personal API Token (pk_ prefix)", async () => {
      const client = new ClickUpClient("pk_test_token_123")
      ;(global.fetch as any).mockResolvedValue(createMockResponse({ teams: [] }))

      await client.listWorkspaces()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "pk_test_token_123"
          })
        })
      )
    })

    it("prefixes Bearer for OAuth 2.0 tokens", async () => {
      const client = new ClickUpClient("oauth_access_token_xyz")
      ;(global.fetch as any).mockResolvedValue(createMockResponse({ teams: [] }))

      await client.listWorkspaces()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer oauth_access_token_xyz"
          })
        })
      )
    })

    it("prefixes Bearer for tokens without pk_ prefix", async () => {
      const client = new ClickUpClient("some_other_token_format")
      ;(global.fetch as any).mockResolvedValue(createMockResponse({ teams: [] }))

      await client.listWorkspaces()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer some_other_token_format"
          })
        })
      )
    })
  })

  describe("file attachment", () => {
    it("uses correct authorization header for file attachments", async () => {
      const client = new ClickUpClient("pk_test_token")
      const formData = new FormData()
      ;(global.fetch as any).mockResolvedValue(createMockResponse({ id: "attachment-123" }))

      await client.attachFile("task-123", formData)

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.clickup.com/api/v2/task/task-123/attachment",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "pk_test_token"
          })
        })
      )
    })

    it("uses Bearer prefix for OAuth tokens in file attachments", async () => {
      const client = new ClickUpClient("oauth_token")
      const formData = new FormData()
      ;(global.fetch as any).mockResolvedValue(createMockResponse({ id: "attachment-123" }))

      await client.attachFile("task-123", formData)

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.clickup.com/api/v2/task/task-123/attachment",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer oauth_token"
          })
        })
      )
    })
  })

  it("throws error if token is not provided", () => {
    expect(() => new ClickUpClient("")).toThrow("CLICKUP_API_TOKEN is required")
  })
})
