import { randomUUID } from "node:crypto"
import type { Express, Request, Response } from "express"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig, SessionConfigInput } from "../application/config/applicationConfig.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import { extractSessionConfig } from "./sessionConfig.js"

type Session = {
  server: McpServer
  transport: StreamableHTTPServerTransport
  connectPromise: Promise<void>
  sessionId?: string
  closed: boolean
  config: ApplicationConfig
}

export function registerHttpTransport(app: Express, createServer: (config: ApplicationConfig) => McpServer) {
  const sessions = new Map<string, Session>()

  function removeSession(session: Session) {
    if (!session.sessionId) {
      return
    }
    const tracked = sessions.get(session.sessionId)
    if (tracked === session) {
      sessions.delete(session.sessionId)
    }
  }

  function createSession(configInput: SessionConfigInput) {
    const config = createApplicationConfig(configInput)
    const server = createServer(config)
    let session: Session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        session.sessionId = sessionId
        sessions.set(sessionId, session)
      },
      onsessionclosed: (sessionId) => {
        if (session.sessionId === sessionId) {
          sessions.delete(sessionId)
        }
      }
    })
    const connectPromise = server.connect(transport)
    session = {
      server,
      transport,
      connectPromise,
      closed: false,
      config
    }
    transport.onclose = () => {
      if (!session.closed) {
        session.closed = true
        removeSession(session)
        server.close().catch(() => undefined)
      }
    }
    return session
  }

  async function ensureSession(req: Request, res: Response) {
    const header = req.headers["mcp-session-id"]
    const sessionId = Array.isArray(header) ? header[header.length - 1] : header
    if (sessionId) {
      const existing = sessions.get(sessionId)
      if (!existing) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Session not found"
          },
          id: null
        })
        return undefined
      }
      return existing
    }
    const config = await extractSessionConfig(req, res)
    if (!config) {
      return undefined
    }
    return createSession(config)
  }

  app.all("/mcp", async (req: Request, res: Response) => {
    const session = await ensureSession(req, res)
    if (!session) {
      return
    }

    try {
      await session.connectPromise
      await session.transport.handleRequest(req, res, req.body)
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" })
      }
      session.transport.close().catch(() => undefined)
    }
  })
}
