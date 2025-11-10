import express from "express"
import cors from "cors"
import request from "supertest"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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

const ORIGINAL_ENV = process.env

type SessionRecord = {
  auth: SessionAuthContext
  config: ApplicationConfig
}

describe("registerHttpTransport authorization", () => {
  beforeEach(() => {
    createdTransports.length = 0
    process.env = { ...ORIGINAL_ENV } as NodeJS.ProcessEnv
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  function setup() {
    const app = express()
    app.use(cors(createCorsOptions()))
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

  it("allows creating a session using the apiKey from config when no authorization header is provided", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ teamId: "team", apiKey: "pk_from_config" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_from_config")
  })

  it("accepts Smithery bracket encoded config parameters", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ "config[teamId]": "team", "config[apiKey]": "pk_bracket" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_bracket")
  })

  it("accepts Smithery config payloads posted in the request body", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .send({ config: { teamId: "team", apiKey: "pk_body" } })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_body")
  })

  it("accepts ClickUp style tokens without a bearer scheme", async () => {
    const { app, sessions } = setup()

    const response = await request(app)
      .post("/mcp")
      .set("Authorization", "pk_test_clickup_token")
      .query({ teamId: "team", apiKey: "pk_test_clickup_token" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.auth.token).toBe("pk_test_clickup_token")
  })

  it("allows session creation when config omits credentials but environment supplies them", async () => {
    const { app, sessions } = setup()
    process.env.TEAM_ID = "team_from_env"
    process.env.CLICKUP_API_TOKEN = "pk_from_env"

    const response = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer pk_from_env")
      .send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBe(200)
    expect(sessions[0]?.config.teamId).toBe("team_from_env")
    expect(sessions[0]?.config.apiKey).toBe("pk_from_env")
    expect(sessions[0]?.auth.token).toBe("pk_from_env")
  })

  it("rejects session creation when provided config values are invalid", async () => {
    const { app } = setup()

    const response = await request(app)
      .post("/mcp")
      .query({ teamId: "   ", apiKey: "" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
    expect(response.body).toBeTruthy()
  })

  it("prevents sessions from being hijacked by a different token", async () => {
    const { app } = setup()

    const first = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-a")
      .query({ teamId: "team", apiKey: "pk_test" })
      .send({ jsonrpc: "2.0", id: 1 })

    expect(first.status).toBe(200)
    const firstTransport = createdTransports[0]
    expect(firstTransport?.sessionId).toBeDefined()

    const valid = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-a")
      .set("mcp-session-id", firstTransport.sessionId!)
      .send({ jsonrpc: "2.0", id: 2 })

    expect(valid.status).toBe(200)

    const hijack = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer token-b")
      .set("mcp-session-id", firstTransport.sessionId!)
      .send({ jsonrpc: "2.0", id: 3 })

    expect(hijack.status).toBe(403)
    expect(hijack.body.error.message).toContain("different")
  })

  it("allows authorization headers during CORS preflight", async () => {
    const { app } = setup()

    const response = await request(app)
      .options("/mcp")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization")

    expect(response.status).toBe(204)
    const allowHeaders = response.headers["access-control-allow-headers"]
    expect(allowHeaders).toBeDefined()
    const headerValue = Array.isArray(allowHeaders) ? allowHeaders.join(",") : allowHeaders
    expect(headerValue).toContain("authorization")
    expect(response.headers["access-control-allow-credentials"]).toBe("true")
  })
})
