import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import type { SessionCache } from "../application/services/SessionCache.js"
import { registerTools } from "../mcp/registerTools.js"
import { registerResources } from "../mcp/registerResources.js"

export function createServer(config: ApplicationConfig, sessionCache: SessionCache) {
  const server = new McpServer({
    name: "ClickUp MCP",
    version: "1.0.0"
  })
  registerTools(server, config, sessionCache)
  registerResources(server, config, sessionCache)
  return server
}
