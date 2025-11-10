import express from "express"
import cors from "cors"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createCorsOptions } from "./cors.js"
import { registerHealthEndpoint } from "./health.js"
import { registerHttpTransport } from "./httpTransport.js"
import { startStdioTransport } from "./stdioTransport.js"
import { sessionConfigJsonSchema } from "./sessionConfig.js"
import type { ApplicationConfig } from "../application/config/applicationConfig.js"
import { registerTools } from "../mcp/registerTools.js"
import type { SessionAuthContext } from "./sessionAuth.js"

function createServer(config: ApplicationConfig, auth: SessionAuthContext) {
  const server = new McpServer({
    name: "ClickUp MCP",
    version: "1.0.0"
  })
  registerTools(server, config, auth)
  return server
}

async function start() {
  const transport = process.env.TRANSPORT ?? "http"
  if (transport === "http") {
    const app = express()
    app.use(cors(createCorsOptions()))
    app.use(express.json({ limit: "2mb" }))
    registerHealthEndpoint(app)
    app.get("/.well-known/mcp-config", (_req, res) => {
      res.json(sessionConfigJsonSchema)
    })
    
    app.use("/mcp", (req, res, next) => {
      const body = req.body
      if (body && typeof body === "object" && typeof body.method === "string") {
        const method = body.method
        if (method === "initialize" || method === "tools/list") {
          const hasTeamId = !!req.query.teamId || !!(req.query as any)["config[teamId]"]
          const hasApiKey = !!req.query.apiKey || !!(req.query as any)["config[apiKey]"]
          
          if (!hasTeamId || !hasApiKey) {
            if (!hasTeamId) {
              req.query.teamId = "placeholder"
            }
            if (!hasApiKey) {
              req.query.apiKey = "placeholder"
            }
          }
        }
      }
      next()
    })
    
    registerHttpTransport(app, createServer)
    const port = Number(process.env.PORT ?? 8081)
    app.listen(port)
  } else {
    await startStdioTransport(createServer)
  }
}

start().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
