import { randomUUID } from "node:crypto"
import type { Express, Request, Response } from "express"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerHttpTransport(app: Express, createServer: () => McpServer) {
  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    })
    res.on("close", () => {
      transport.close()
      server.close()
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" })
      }
      transport.close()
      server.close()
    }
  })
}
