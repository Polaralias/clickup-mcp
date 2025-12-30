import { fileURLToPath } from "url"
import { dirname, join } from "path"
import express from "express"
import cors from "cors"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createCorsOptions } from "./cors.js"
import { registerHealthEndpoint } from "./health.js"
import { registerHttpTransport } from "./httpTransport.js"
import { startStdioTransport } from "./stdioTransport.js"
import { sessionConfigJsonSchema } from "./sessionConfig.js"
import { SessionCache } from "../application/services/SessionCache.js"
import apiRouter from "./api/router.js"
import { runMigrations } from "../infrastructure/db/migrator.js"
import { createServer } from "./factory.js"

async function start() {
  if (process.env.MASTER_KEY) {
      try {
          await runMigrations()
      } catch (e) {
          console.error("Migration failed, but continuing:", e)
      }
  }

  const transport = process.env.TRANSPORT ?? "http"
  if (transport === "http") {
    const app = express()
    app.set("trust proxy", true)
    app.use(cors(createCorsOptions()))
    app.use(express.json({ limit: "2mb" }))

    app.use("/api", apiRouter)

    const __dirname = dirname(fileURLToPath(import.meta.url))
    // Serve static UI files from public directory
    app.use(express.static(join(__dirname, "../public")))

    registerHealthEndpoint(app)
    app.get("/.well-known/mcp-config", (_req, res) => {
      res.json(sessionConfigJsonSchema)
    })
    registerHttpTransport(app, createServer)
    const port = Number(process.env.PORT ?? 8081)
    app.listen(port)
  } else {
    await startStdioTransport(createServer, (config) =>
      new SessionCache(config.hierarchyCacheTtlMs, config.spaceConfigCacheTtlMs)
    )
  }
}

start().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
