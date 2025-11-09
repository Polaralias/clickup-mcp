import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ApplicationConfig } from "../../application/config/applicationConfig.js"
import { registerHttpTransport } from "../httpTransport.js"
import type { SessionAuthContext } from "../sessionAuth.js"

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

describe("registerHttpTransport authorization", () => {
  beforeEach(() => {
    createdTransports.length = 0
  })

  function setup() {
    const app = express()
    app.use(express.json())
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

  it("rejects requests without a bearer token", async () => {
    const { app, createServer } = setup()

    const response = await request(app).post("/mcp").send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBe(401)
    expect(response.body.error.message).toContain("Bearer")
    expect(createServer).not.toHaveBeenCalled()
  })

  it("prevents sessions from being hijacked by a different token", async () => {
    const { app } = setup()

    const first = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-a")
      .query({ teamId: "team-1", apiKey: "token-1" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(first.status).toBe(200)
    const firstTransport = createdTransports[0]
    expect(firstTransport?.sessionId).toBeDefined()

    const valid = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-a")
      .set("mcp-session-id", firstTransport.sessionId!)
      .query({ teamId: "team-1", apiKey: "token-1" })
      .send({ jsonrpc: "2.0", id: 2 })

    expect(valid.status).toBe(200)

    const hijack = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-b")
      .set("mcp-session-id", firstTransport.sessionId!)
      .query({ teamId: "team-1", apiKey: "token-1" })
      .send({ jsonrpc: "2.0", id: 3 })

    expect(hijack.status).toBe(403)
    expect(hijack.body.error.message).toContain("different")
  })
})
