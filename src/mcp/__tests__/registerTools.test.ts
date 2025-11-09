import { beforeEach, describe, expect, it, vi } from "vitest"
import { registerTools } from "../registerTools.js"
import { createApplicationConfig } from "../../application/config/applicationConfig.js"
import type { SessionAuthContext } from "../../server/sessionAuth.js"

const createdClientTokens: string[] = []
const listMembersCalls: Array<{ token: string; teamId: string }> = []
const memberResponses = new Map<string, { members: Array<Record<string, unknown>> }>()

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
      async listMembers(teamId: string) {
        listMembersCalls.push({ token: this.token, teamId })
        return memberResponses.get(this.token) ?? { members: [] }
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
    listMembersCalls.length = 0
    memberResponses.clear()
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

  it("isolates member directory caches per session token", async () => {
    const config = createApplicationConfig({ defaultTeamId: "team-1" })

    memberResponses.set("token-a", {
      members: [
        { id: "1", name: "Alice A", email: "alice@example.com" }
      ]
    })
    memberResponses.set("token-b", {
      members: [
        { id: "2", name: "Bob B", email: "bob@example.com" }
      ]
    })

    const stubA = createStubServer()
    const stubB = createStubServer()

    registerTools(stubA.server as any, config, { token: "token-a" })
    registerTools(stubB.server as any, config, { token: "token-b" })

    const parse = (result: unknown) => {
      const text = (result as any)?.content?.[0]?.text
      if (typeof text !== "string") {
        throw new Error("Unexpected tool response format")
      }
      return JSON.parse(text)
    }

    const firstA = parse(
      await stubA.invoke("clickup_find_member_by_name", { teamId: "team-1", query: "Alice" })
    )
    expect(listMembersCalls.filter((call) => call.token === "token-a")).toHaveLength(1)
    expect(firstA.matches[0]?.memberId).toBe("1")

    const firstB = parse(
      await stubB.invoke("clickup_find_member_by_name", { teamId: "team-1", query: "Bob" })
    )
    expect(listMembersCalls.filter((call) => call.token === "token-b")).toHaveLength(1)
    expect(firstB.matches[0]?.memberId).toBe("2")

    const secondA = parse(
      await stubA.invoke("clickup_find_member_by_name", { teamId: "team-1", query: "Alice" })
    )
    expect(listMembersCalls.filter((call) => call.token === "token-a")).toHaveLength(1)
    expect(secondA.matches[0]?.memberId).toBe("1")
  })
})
