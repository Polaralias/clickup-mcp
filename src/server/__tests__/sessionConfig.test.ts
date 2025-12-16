import { describe, expect, it, vi } from "vitest"
import type { Request, Response } from "express"
import { extractSessionConfig, sessionConfigJsonSchema } from "../sessionConfig.js"

describe("extractSessionConfig", () => {
  function createMockRequest(query: Record<string, string | string[] | undefined>): Request {
    return { query } as Request
  }

  function createMockResponse() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    } as unknown as Response
    return res
  }

  it("extracts teamId from query parameters", async () => {
    const req = createMockRequest({ teamId: "team_123", apiKey: "pk_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_123")
    expect(res.status).not.toHaveBeenCalled()
  })

  it("accepts teamID synonym", async () => {
    const req = createMockRequest({ teamID: "team_456", apiKey: "pk_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_456")
  })

  it("accepts workspaceId synonym", async () => {
    const req = createMockRequest({ workspaceId: "workspace_789", apiKey: "pk_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.teamId).toBe("workspace_789")
  })

  it("accepts workspaceID synonym", async () => {
    const req = createMockRequest({ workspaceID: "workspace_101", apiKey: "pk_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.teamId).toBe("workspace_101")
  })

  it("handles array values by taking the last element", async () => {
    const req = createMockRequest({
      teamId: ["team_1", "team_2", "team_3"],
      apiKey: "pk_123"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_3")
  })

  it("returns HTTP 400 with plain error when teamId is missing", async () => {
    const req = createMockRequest({ apiKey: "pk_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid configuration: missing teamId"
    })
  })

  it("returns HTTP 400 when apiKey is missing", async () => {
    const req = createMockRequest({ teamId: "team_123" })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid configuration: missing apiKey"
    })
  })

  it("parses numeric charLimit when provided", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      charLimit: "20000"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.charLimit).toBe(20000)
  })

  it("parses numeric maxAttachmentMb when provided", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      maxAttachmentMb: "10"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.maxAttachmentMb).toBe(10)
  })

  it("omits charLimit if it's an invalid number", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      charLimit: "invalid"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.charLimit).toBeUndefined()
  })

  it("omits maxAttachmentMb if it's an invalid number", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      maxAttachmentMb: "not-a-number"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.maxAttachmentMb).toBeUndefined()
  })

  it("parses selectiveWrite when provided", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      selectiveWrite: "true"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.selectiveWrite).toBe(true)
  })

  it("parses readOnly when provided", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      readOnly: "true"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config).toBeDefined()
    expect(config?.readOnly).toBe(true)
  })

  it("parses writeSpaces and writeLists when provided", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      writeSpaces: ["space_a", " space_b "],
      writeLists: "list_1, list_2"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config?.writeSpaces).toEqual(["space_a", "space_b"])
    expect(config?.writeLists).toEqual(["list_1", "list_2"])
  })

  it("parses kebab-case parameters", async () => {
    const req = createMockRequest({
      teamId: "team_123",
      apiKey: "pk_123",
      "char-limit": "5000",
      "max-attachment-mb": "20",
      "read-only": "true",
      "selective-write": "true",
      "write-spaces": "space_1",
      "write-lists": "list_1"
    })
    const res = createMockResponse()

    const config = await extractSessionConfig(req, res)

    expect(config?.charLimit).toBe(5000)
    expect(config?.maxAttachmentMb).toBe(20)
    expect(config?.readOnly).toBe(true)
    expect(config?.selectiveWrite).toBe(true)
    expect(config?.writeSpaces).toEqual(["space_1"])
    expect(config?.writeLists).toEqual(["list_1"])
  })

  it("handles writeLists as JSON string", async () => {
    const req = createMockRequest({
      teamId: "team", apiKey: "key",
      writeLists: '["123", "456"]'
    })
    const res = createMockResponse()
    const config = await extractSessionConfig(req, res)
    expect(config?.writeLists).toEqual(["123", "456"])
  })
})

describe("sessionConfigJsonSchema", () => {
  it("uses JSON Schema draft-07", () => {
    expect(sessionConfigJsonSchema.$schema).toBe("https://json-schema.org/draft-07/schema")
  })

  it("has an absolute $id", () => {
    expect(sessionConfigJsonSchema.$id).toBe("https://clickup-mcp-server/.well-known/mcp-config")
  })

  it("requires teamId and apiKey", () => {
    expect(sessionConfigJsonSchema.required).toEqual(["teamId", "apiKey"])
  })

  it("includes exampleConfig", () => {
    expect(sessionConfigJsonSchema.exampleConfig).toBeDefined()
    expect(sessionConfigJsonSchema.exampleConfig.teamId).toBe("team_123")
    expect(sessionConfigJsonSchema.exampleConfig.apiKey).toBe("pk_123")
    expect(sessionConfigJsonSchema.exampleConfig.charLimit).toBe(16000)
    expect(sessionConfigJsonSchema.exampleConfig.maxAttachmentMb).toBe(8)
    expect(sessionConfigJsonSchema.exampleConfig.selectiveWrite).toBe(false)
    expect(sessionConfigJsonSchema.exampleConfig.readOnly).toBe(false)
    expect(sessionConfigJsonSchema.exampleConfig.writeSpaces).toEqual([])
    expect(sessionConfigJsonSchema.exampleConfig.writeLists).toEqual([])
  })

  it("preserves x-query-style", () => {
    expect(sessionConfigJsonSchema["x-query-style"]).toBe("dot+bracket")
  })
})
