import { beforeEach, describe, expect, it, vi } from "vitest"
import { registerTools } from "../registerTools.js"
import { createApplicationConfig } from "../../application/config/applicationConfig.js"
import type { SessionAuthContext } from "../../server/sessionAuth.js"

const createdClientTokens: string[] = []

vi.mock("../../infrastructure/clickup/ClickUpClient.js", () => {
  return {
    ClickUpClient: class {
      token: string
      constructor(token: string) {
        this.token = token
        createdClientTokens.push(token)
      }
      async listWorkspaces() {
        return { teams: [] }
      }
    }
  }
})

type RegisteredHandler = (rawInput: unknown) => Promise<unknown>

type StubServer = {
  server: unknown
  invoke: (name: string, input?: unknown) => Promise<unknown>
}

function createStubServer(): StubServer {
  const handlers = new Map<string, RegisteredHandler>()
  const server = {
    registerTool: (_name: string, _details: unknown, handler: RegisteredHandler) => {
      handlers.set(_name, handler)
    }
  }
  return {
    server,
    invoke: async (name: string, input?: unknown) => {
      const handler = handlers.get(name)
      if (!handler) {
        throw new Error(`Handler ${name} not registered`)
      }
      return handler(input)
    }
  }
}

describe("registerTools", () => {
  beforeEach(() => {
    createdClientTokens.length = 0
  })

  async function registerAndInvoke(token: string) {
    const config = createApplicationConfig({})
    const auth: SessionAuthContext = { token }
    const stub = createStubServer()
    registerTools(stub.server as any, config, auth)
    await stub.invoke("clickup_list_workspaces")
  }

  it("isolates ClickUp clients per session token", async () => {
    await registerAndInvoke("token-a")
    expect(createdClientTokens).toEqual(["token-a"])

    await registerAndInvoke("token-b")
    expect(createdClientTokens).toEqual(["token-a", "token-b"])
  })
})
