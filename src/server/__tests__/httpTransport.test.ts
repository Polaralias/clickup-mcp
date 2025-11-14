import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Request, Response, NextFunction, Express } from "express"
import { registerHttpTransport } from "../httpTransport.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ApplicationConfig } from "../../application/config/applicationConfig.js"

type TransportInstance = {
  sessionId?: string
  handleRequest: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

const transportInstances: TransportInstance[] = []

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => {
  class MockTransport {
    options: any
    sessionId?: string
    handleRequest: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    onclose?: () => void

    constructor(options: any) {
      this.options = options
      this.handleRequest = vi.fn(async (_req: Request, _res: Response) => {
        if (!this.sessionId) {
          this.sessionId = this.options.sessionIdGenerator()
          this.options.onsessioninitialized?.(this.sessionId)
        }
      })
      this.close = vi.fn(async () => {
        if (this.sessionId) {
          this.options.onsessionclosed?.(this.sessionId)
        }
      })
      transportInstances.push(this)
    }
  }

  return { StreamableHTTPServerTransport: MockTransport }
})

type Handler = (req: Request, res: Response, next: NextFunction) => unknown
type MutableRequest = Request & { sessionCredential?: { token: string } }

describe("registerHttpTransport", () => {
  beforeEach(() => {
    transportInstances.length = 0
  })

  it("reuses an existing session when the request lacks authorization but includes the session id", async () => {
    const handlers: Handler[] = []
    const app = {
      all: vi.fn((_path: string, ...routeHandlers: Handler[]) => {
        handlers.push(...routeHandlers)
      })
    } as unknown as Express

    const connect = vi.fn(async () => undefined)
    const close = vi.fn(async () => undefined)

    const createServer = vi.fn((_config: ApplicationConfig) => ({
      connect,
      close
    }) as unknown as McpServer)

    registerHttpTransport(app, createServer)

    expect(app.all).toHaveBeenCalled()
    expect(handlers).toHaveLength(2)

    const [authMiddleware, routeHandler] = handlers

    const initialReq = {
      headers: {
        authorization: "Bearer token-123",
        accept: "application/json"
      },
      query: { teamId: "team_1" },
      body: {}
    } as unknown as MutableRequest
    const initialRes = createResponse()
    const next = vi.fn()

    authMiddleware(initialReq, initialRes, next)
    expect(next).toHaveBeenCalledOnce()

    await routeHandler(initialReq, initialRes, vi.fn())

    expect(transportInstances).toHaveLength(1)
    const sessionId = transportInstances[0].sessionId
    expect(sessionId).toBeDefined()
    expect(createServer).toHaveBeenCalledTimes(1)

    const followupReq = {
      headers: {
        "mcp-session-id": sessionId,
        accept: "application/json"
      }
    } as unknown as MutableRequest
    const followupRes = createResponse()
    const followupNext = vi.fn()

    authMiddleware(followupReq, followupRes, followupNext)
    expect(followupNext).toHaveBeenCalledOnce()

    await routeHandler(followupReq, followupRes, vi.fn())

    expect(createServer).toHaveBeenCalledTimes(1)
    expect(transportInstances[0].handleRequest).toHaveBeenCalledTimes(2)
    expect(followupReq.sessionCredential?.token).toBe("token-123")
  })
})

function createResponse() {
  return {
    headersSent: false,
    statusCode: 200,
    status(this: Response, code: number) {
      this.statusCode = code
      return this
    },
    json(this: Response, body: unknown) {
      this.headersSent = true
      return body
    },
    setHeader: vi.fn(),
    end: vi.fn()
  } as unknown as Response
}
