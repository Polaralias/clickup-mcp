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
import authRouter from "./authRouter.js"
import { runMigrations } from "../infrastructure/db/migrator.js"
import { createServer } from "./factory.js"
import { initializeServices } from "./services.js"

async function start() {
  try {
    await runMigrations()
    initializeServices()
  } catch (e) {
    console.error("Migration failed, but continuing:", e)
  }

  const transport = process.env.TRANSPORT ?? "http"
  if (transport === "http") {
    const app = express()
    app.set("trust proxy", true)
    app.use(cors(createCorsOptions()))
    app.use(express.json({ limit: "2mb" }))

    app.use("/api", apiRouter)
    app.use("/", authRouter)

    const __dirname = dirname(fileURLToPath(import.meta.url))
    // Serve static UI files from public directory
    app.use(express.static(join(__dirname, "../public")))

    registerHealthEndpoint(app)

    // Helper to get base URL
    const getBaseUrl = (req: express.Request) => {
      if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "")
      const protocol = req.protocol
      const host = req.get("host")
      return `${protocol}://${host}`
    }

    app.get("/.well-known/oauth-protected-resource", (req, res) => {
      const baseUrl = getBaseUrl(req)
      res.json({
        resource: baseUrl,
        authorization_servers: [baseUrl]
      })
    })

    app.get("/.well-known/oauth-authorization-server", (req, res) => {
      const baseUrl = getBaseUrl(req)
      res.json({
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/connect`,
        token_endpoint: `${baseUrl}/token`,
        registration_endpoint: `${baseUrl}/register`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"]
      })
    })

    app.get("/.well-known/mcp-config", (_req, res) => {
      res.json(sessionConfigJsonSchema)
    })
    registerHttpTransport(app, createServer)
    const port = Number(process.env.PORT ?? 3000)
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
