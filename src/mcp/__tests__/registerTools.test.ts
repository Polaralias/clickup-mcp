import { describe, expect, it } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerTools } from "../registerTools.js"
import type { ApplicationConfig } from "../../application/config/applicationConfig.js"

describe("registerTools", () => {
  it("registers tools successfully with config.apiKey", () => {
    const config: ApplicationConfig = {
      teamId: "test-team",
      apiKey: "test-api-key",
      charLimit: 16000,
      maxAttachmentMb: 8
    }

    const server = new McpServer({
      name: "Test Server",
      version: "1.0.0"
    })

    // This should not throw because config.apiKey is provided
    expect(() => registerTools(server, config)).not.toThrow()
  })

  it("registers tools with config.apiKey even when environment variables are not set", () => {
    const config: ApplicationConfig = {
      teamId: "test-team",
      apiKey: "session-api-key-123",
      charLimit: 16000,
      maxAttachmentMb: 8
    }

    // Save and clear environment variables to verify they're not needed
    const originalClickUpToken = process.env.CLICKUP_API_TOKEN
    const originalClickupApiToken = process.env.clickupApiToken
    delete process.env.CLICKUP_API_TOKEN
    delete process.env.clickupApiToken

    try {
      const server = new McpServer({
        name: "Test Server",
        version: "1.0.0"
      })

      // This should not throw even though env vars are not set
      // because it should use config.apiKey from the session
      expect(() => registerTools(server, config)).not.toThrow()
    } finally {
      // Restore original environment
      if (originalClickUpToken !== undefined) {
        process.env.CLICKUP_API_TOKEN = originalClickUpToken
      }
      if (originalClickupApiToken !== undefined) {
        process.env.clickupApiToken = originalClickupApiToken
      }
    }
  })
})
