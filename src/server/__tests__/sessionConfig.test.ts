import { describe, expect, it } from "vitest"
import { SessionConfigSchema, sessionConfigJsonSchema } from "../sessionConfig.js"

describe("SessionConfigSchema", () => {
  it("validates when teamId and apiKey are provided", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "team_123",
      apiKey: "pk_123"
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.teamId).toBe("team_123")
      expect(result.data.apiKey).toBe("pk_123")
    }
  })

  it("validates with optional charLimit and maxAttachmentMb", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "team_123",
      apiKey: "pk_123",
      charLimit: 16000,
      maxAttachmentMb: 8
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.charLimit).toBe(16000)
      expect(result.data.maxAttachmentMb).toBe(8)
    }
  })

  it("fails validation when teamId is missing", () => {
    const result = SessionConfigSchema.safeParse({
      apiKey: "pk_123"
    })
    expect(result.success).toBe(false)
  })

  it("fails validation when apiKey is missing", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "team_123"
    })
    expect(result.success).toBe(false)
  })

  it("fails validation when teamId is empty string", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "",
      apiKey: "pk_123"
    })
    expect(result.success).toBe(false)
  })

  it("fails validation when apiKey is empty string", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "team_123",
      apiKey: ""
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from teamId and apiKey", () => {
    const result = SessionConfigSchema.safeParse({
      teamId: "  team_123  ",
      apiKey: "  pk_123  "
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.teamId).toBe("team_123")
      expect(result.data.apiKey).toBe("pk_123")
    }
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
