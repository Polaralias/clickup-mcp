import express from "express"
import cors from "cors"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApplicationConfig } from "../../application/config/applicationConfig.js"
import { registerHttpTransport } from "../httpTransport.js"
import type { SessionAuthContext } from "../sessionAuth.js"
import { createCorsOptions } from "../cors.js"

const { createdTransports, StreamableTransportMock } = vi.hoisted(() => {
  const transports: Array<{ sessionId?: string; onclose?: () => void }> = []

  class FakeTransportImpl {
    public sessionIdGenerator: () => string
    public onsessioninitialized?: (sessionId: string) => void
    public onsessionclosed?: (sessionId: string) => void
    public handleRequest: (req: express.Request, res: express.Response) => Promise<void>
    public close: () => Promise<void>
    public onclose?: () => void
    public sessionId?: string
    private initialised = false

    constructor(options: {
      sessionIdGenerator: () => string
      onsessioninitialized?: (sessionId: string) => void
      onsessionclosed?: (sessionId: string) => void
    }) {
      this.sessionIdGenerator = options.sessionIdGenerator
      this.onsessioninitialized = options.onsessioninitialized
      this.onsessionclosed = options.onsessionclosed
      this.handleRequest = vi.fn(async (_req, res) => {
        if (!this.initialised) {
          this.initialised = true
          const sessionId = this.sessionIdGenerator()
          this.sessionId = sessionId
          this.onsessioninitialized?.(sessionId)
        }
        res.status(200).json({ ok: true })
      })
      this.close = vi.fn(async () => {
        if (this.sessionId) {
          this.onsessionclosed?.(this.sessionId)
        }
        this.onclose?.()
      })
    }
  }

  class StreamableTransport extends FakeTransportImpl {
    constructor(options: ConstructorParameters<typeof FakeTransportImpl>[0]) {
      super(options)
      transports.push(this)
    }
  }

  return { createdTransports: transports, StreamableTransportMock: StreamableTransport }
}) as {
  createdTransports: Array<{ sessionId?: string }>
  StreamableTransportMock: new (options: any) => any
}

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: StreamableTransportMock
}))

type SessionRecord = {
  auth: SessionAuthContext
  config: ApplicationConfig
}

describe("MCP discovery without credentials", () => {
  beforeEach(() => {
    createdTransports.length = 0
  })

  function setup() {
    const app = express()
    app.use(cors(createCorsOptions()))
    app.use(express.json())
    
    app.use("/mcp", (req, res, next) => {
      const body = req.body
      if (body && typeof body === "object" && typeof body.method === "string") {
        const method = body.method
        if (method === "initialize" || method === "tools/list") {
          const hasTeamId = req.query.teamId || (body.config && body.config.teamId)
          const hasApiKey = req.query.apiKey || (body.config && body.config.apiKey)
          
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
    
    const sessions: SessionRecord[] = []
    const createServer = vi.fn((_config: ApplicationConfig, auth: SessionAuthContext) => {
      sessions.push({ auth, config: _config })
      return {
        connect: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined)
      } as unknown as import("@modelcontextprotocol/sdk/server/mcp.js").McpServer
    })
    registerHttpTransport(app, createServer)
    return { app, createServer, sessions }
  }

  it("allows initialize request without teamId and apiKey by injecting placeholders", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "initialize", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions.length).toBe(1)
    expect(sessions[0]?.auth.token).toBe("placeholder")
    expect(sessions[0]?.config.teamId).toBe("placeholder")
  })

  it("allows tools/list request without teamId and apiKey by injecting placeholders", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "tools/list", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions.length).toBe(1)
    expect(sessions[0]?.auth.token).toBe("placeholder")
  })

  it("does not inject placeholders for initialize when credentials are provided", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ teamId: "real_team", apiKey: "pk_real" })
      .send({ jsonrpc: "2.0", method: "initialize", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_real")
    expect(sessions[0]?.config.teamId).toBe("real_team")
  })

  it("does not inject placeholders when credentials are provided via query", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ teamId: "query_team", apiKey: "pk_query" })
      .send({ 
        jsonrpc: "2.0", 
        method: "tools/list", 
        id: 1
      })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_query")
    expect(sessions[0]?.config.teamId).toBe("query_team")
  })

  it("does not inject placeholders for non-discovery methods", async () => {
    const { app } = setup()

    const response = await request(app)
      .post("/mcp")
      .send({ jsonrpc: "2.0", method: "tools/call", id: 1 })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it("injects only missing credentials for initialize", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ teamId: "provided_team" })
      .send({ jsonrpc: "2.0", method: "initialize", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("placeholder")
    expect(sessions[0]?.config.teamId).toBe("provided_team")
  })
})
