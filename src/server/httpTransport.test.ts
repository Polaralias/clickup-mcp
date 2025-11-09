import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { registerHttpTransport as registerHttpTransportType } from "./httpTransport.js"

vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => {
  class FakeStreamableHTTPServerTransport {
    onclose?: () => void
    options: unknown

    constructor(options: unknown) {
      this.options = options
    }

    handleRequest = vi.fn(async () => {})

    close = vi.fn(async () => {})
  }

  return { StreamableHTTPServerTransport: FakeStreamableHTTPServerTransport }
})

type McpServerLike = {
  connect: (transport: unknown) => Promise<void>
  close: () => Promise<void>
}

function createStubServer(): McpServerLike {
  return {
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {})
  }
}

async function loadRegisterHttpTransport() {
  const module = await import("./httpTransport.js")
  return module.registerHttpTransport as typeof registerHttpTransportType
}

describe("registerHttpTransport", () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    app = express()
    app.use(express.json())
  })

  it("responds with 422 when session config validation fails", async () => {
    const createServer = vi.fn(() => createStubServer())
    const registerHttpTransport = await loadRegisterHttpTransport()
    registerHttpTransport(app, createServer)

    const response = await request(app)
      .post("/mcp")
      .send({ teamId: "team", apiKey: "" })

    expect(response.status).toBe(422)
    expect(response.body).toHaveProperty("errors")
    expect(createServer).not.toHaveBeenCalled()
  })

  it("responds with 401 when no authorization token is available", async () => {
    const createServer = vi.fn(() => createStubServer())
    const configSpy = vi.fn().mockResolvedValue({ teamId: "team", apiKey: "" })

    vi.doMock("./sessionConfig.js", async () => {
      const actual = await vi.importActual<typeof import("./sessionConfig.js")>("./sessionConfig.js")
      return {
        ...actual,
        extractSessionConfig: configSpy
      }
    })

    const registerHttpTransport = await loadRegisterHttpTransport()
    registerHttpTransport(app, createServer)

    const response = await request(app).post("/mcp")

    expect(response.status).toBe(401)
    expect(response.body.error?.message).toBe(
      "Provide a valid Bearer token in the Authorization header or include an apiKey in the session configuration"
    )
    expect(configSpy).toHaveBeenCalled()
    expect(createServer).not.toHaveBeenCalled()
  })
})
