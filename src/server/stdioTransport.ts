import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"

export async function startStdioTransport(createServer: (config: ApplicationConfig) => McpServer) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const transport = new StdioServerTransport()
  const config = createApplicationConfig({})
  const server = createServer(config)
  await server.connect(transport)
  await transport.start()
}
