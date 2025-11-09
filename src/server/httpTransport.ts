import { randomUUID } from "node:crypto"
import type { Express, Request, Response } from "express"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig, SessionConfigInput } from "../application/config/applicationConfig.js"
import { createApplicationConfig } from "../application/config/applicationConfig.js"
import { extractSessionConfig } from "./sessionConfig.js"
import type { SessionAuthContext } from "./sessionAuth.js"

type Session = {
  server: McpServer
  transport: StreamableHTTPServerTransport
  connectPromise: Promise<void>
  sessionId?: string
  closed: boolean
  config: ApplicationConfig
  auth: SessionAuthContext
}

type CreateServer = (config: ApplicationConfig, auth: SessionAuthContext) => McpServer

const unauthorizedError = {
  jsonrpc: "2.0",
  error: {
    code: -32002,
    message: "Authorization is required"
  },
  id: null
} as const

function respondWithAuthError(res: Response, status: number, message: string) {
  res.status(status).json({
    ...unauthorizedError,
    error: {
      ...unauthorizedError.error,
      message
    }
  })
}

function parseAuthorizationHeader(header: string | undefined) {
  if (!header) {
    return undefined
  }
  const trimmed = header.trim()
  if (!trimmed) {
    return undefined
  }
  const [scheme, ...rest] = trimmed.split(/\s+/)
  if (rest.length === 0) {
    return undefined
  }
  if (scheme.toLowerCase() !== "bearer") {
    return undefined
  }
  const token = rest.join(" ").trim()
  if (!token) {
    return undefined
  }
  return token
}

export function registerHttpTransport(app: Express, createServer: CreateServer) {
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

  function createSession(configInput: SessionConfigInput, auth: SessionAuthContext) {
    const config = createApplicationConfig(configInput)
    const server = createServer(config, auth)
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
      config,
      auth
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
    const token = parseAuthorizationHeader(req.header("authorization"))
    if (!token) {
      respondWithAuthError(res, 401, "Provide a valid Bearer token in the Authorization header")
      return undefined
    }
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
      if (existing.auth.token !== token) {
        respondWithAuthError(res, 403, "Session is owned by a different authorization token")
        return undefined
      }
      return existing
    }
    const config = await extractSessionConfig(req, res)
    if (!config) {
      return undefined
    }
    return createSession(config, { token })
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
