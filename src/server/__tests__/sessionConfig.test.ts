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

  it("extracts teamId and apiKey from query parameters", async () => {
    const req = createMockRequest({ teamId: "team_123", apiKey: "pk_123" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_123")
    expect(config?.apiKey).toBe("pk_123")
    expect(res.status).not.toHaveBeenCalled()
  })

  it("accepts teamID synonym", async () => {
    const req = createMockRequest({ teamID: "team_456", apiKey: "pk_456" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_456")
  })

  it("accepts workspaceId synonym", async () => {
    const req = createMockRequest({ workspaceId: "workspace_789", apiKey: "pk_789" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.teamId).toBe("workspace_789")
  })

  it("accepts workspaceID synonym", async () => {
    const req = createMockRequest({ workspaceID: "workspace_101", apiKey: "pk_101" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.teamId).toBe("workspace_101")
  })

  it("accepts api_key synonym", async () => {
    const req = createMockRequest({ teamId: "team_202", api_key: "pk_202" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.apiKey).toBe("pk_202")
  })

  it("accepts token synonym", async () => {
    const req = createMockRequest({ teamId: "team_303", token: "pk_303" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.apiKey).toBe("pk_303")
  })

  it("handles array values by taking the last element", async () => {
    const req = createMockRequest({ 
      teamId: ["team_1", "team_2", "team_3"], 
      apiKey: ["pk_1", "pk_2"] 
    })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeDefined()
    expect(config?.teamId).toBe("team_3")
    expect(config?.apiKey).toBe("pk_2")
  })

  it("returns HTTP 200 with JSON-RPC error when teamId is missing", async () => {
    const req = createMockRequest({ apiKey: "pk_123" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32602, message: "Invalid configuration: missing teamId" }
    })
  })

  it("returns HTTP 200 with JSON-RPC error when apiKey is missing", async () => {
    const req = createMockRequest({ teamId: "team_123" })
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32602, message: "Invalid configuration: missing apiKey" }
    })
  })

  it("returns HTTP 200 with JSON-RPC error when both are missing", async () => {
    const req = createMockRequest({})
    const res = createMockResponse()
    
    const config = await extractSessionConfig(req, res)
    
    expect(config).toBeUndefined()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32602, message: "Invalid configuration: missing teamId, apiKey" }
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
  })

  it("preserves x-query-style", () => {
    expect(sessionConfigJsonSchema["x-query-style"]).toBe("dot+bracket")
  })
})
