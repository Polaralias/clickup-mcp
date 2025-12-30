import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { SessionCache } from "../application/services/SessionCache.js"
import { resolveTeamIdFromApiKey } from "./teamResolution.js"

export async function startStdioTransport(
  createServer: (config: ApplicationConfig, sessionCache: SessionCache) => McpServer,
  createSessionCache: (config: ApplicationConfig) => SessionCache
) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const transport = new StdioServerTransport()

  let config: ApplicationConfig
  try {
    config = createApplicationConfig({})
  } catch (error) {
    const apiKey = process.env.CLICKUP_API_TOKEN ?? process.env.clickupApiToken ?? process.env.apiKey ?? process.env.API_KEY
    if (apiKey && error instanceof Error && error.message.includes("teamId")) {
      try {
        const teamId = await resolveTeamIdFromApiKey(apiKey)
        // Temporarily set env var for config creation
        process.env.TEAM_ID = teamId
        config = createApplicationConfig({})
      } catch (resolveError) {
        throw error
      }
    } else {
      throw error
    }
  }

  const sessionCache = createSessionCache(config)
  const server = createServer(config, sessionCache)
  await server.connect(transport)
  await transport.start()
}
