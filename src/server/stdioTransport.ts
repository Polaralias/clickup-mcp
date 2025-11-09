import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import type { SessionAuthContext } from "./sessionAuth.js"

function resolveEnvToken() {
  const token = process.env.CLICKUP_API_TOKEN ?? process.env.clickupApiToken ?? ""
  const trimmed = token.trim()
  if (!trimmed) {
    throw new Error("CLICKUP_API_TOKEN is required when using stdio transport")
  }
  return trimmed
}

export async function startStdioTransport(createServer: (config: ApplicationConfig, auth: SessionAuthContext) => McpServer) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const transport = new StdioServerTransport()
  const config = createApplicationConfig({})
  const token = resolveEnvToken()
  const server = createServer(config, { token })
  await server.connect(transport)
  await transport.start()
}
