import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { SessionCache } from "../application/services/SessionCache.js"

export async function startStdioTransport(
  createServer: (config: ApplicationConfig, sessionCache: SessionCache) => McpServer,
  createSessionCache: (config: ApplicationConfig) => SessionCache
) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const transport = new StdioServerTransport()
  const config = createApplicationConfig({})
  const sessionCache = createSessionCache(config)
  const server = createServer(config, sessionCache)
  await server.connect(transport)
  await transport.start()
}
