import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export async function startStdioTransport(createServer: () => McpServer) {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
  const transport = new StdioServerTransport()
  const server = createServer()
  await server.connect(transport)
  await transport.start()
}
