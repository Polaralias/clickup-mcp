import express from "express"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerHttpTransport } from "./httpTransport.js"
import type { CreateServer } from "./httpTransport.js"
import * as sessionConfigModule from "./sessionConfig.js"

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

function createStubServer(): McpServer {
  return {
    connect: vi.fn(async () => {}),
    close: vi.fn(async () => {})
  } as unknown as McpServer
}

describe("registerHttpTransport", () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = express()
    app.use(express.json())
  })

  it("responds with 422 when session config validation fails", async () => {
    const createServer = vi.fn<CreateServer>(() => createStubServer())
    registerHttpTransport(app, createServer)

    const response = await request(app)
      .post("/mcp")
      .send({ teamId: "team", apiKey: "" })

    expect(response.status).toBe(422)
    expect(response.body).toHaveProperty("errors")
    expect(createServer).not.toHaveBeenCalled()
  })

  it("responds with 401 when no authorization token is available", async () => {
    const createServer = vi.fn<CreateServer>(() => createStubServer())
    registerHttpTransport(app, createServer)

    const configSpy = vi
      .spyOn(sessionConfigModule, "extractSessionConfig")
      .mockResolvedValue({ teamId: "team", apiKey: "" })

    const response = await request(app).post("/mcp")

    expect(response.status).toBe(401)
    expect(response.body.error?.message).toBe("Provide a valid apiKey in the session configuration")
    expect(configSpy).toHaveBeenCalled()
    expect(createServer).not.toHaveBeenCalled()
  })
})
