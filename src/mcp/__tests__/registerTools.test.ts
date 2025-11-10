import { beforeEach, describe, expect, it, vi } from "vitest"
import { registerTools } from "../registerTools.js"
import { createApplicationConfig } from "../../application/config/applicationConfig.js"
import type { SessionAuthContext } from "../../server/sessionAuth.js"

const createdClientKeys: string[] = []
const listMembersCalls: Array<{ apiKey: string; teamId: string }> = []
const memberResponses = new Map<string, { members: Array<Record<string, unknown>> }>()

vi.mock("../../infrastructure/clickup/ClickUpClient.js", () => {
  return {
    ClickUpClient: class {
      token: string
      constructor(token: string) {
        this.token = token
        createdClientKeys.push(token)
      }
      async listWorkspaces() {
        return { teams: [] }
      }
      async listMembers(teamId: string) {
        listMembersCalls.push({ apiKey: this.token, teamId })
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
    createdClientKeys.length = 0
    listMembersCalls.length = 0
    memberResponses.clear()
  })

  async function registerAndInvoke(token: string) {
    const config = createApplicationConfig({ teamId: "team-1", apiKey: token })
    const auth: SessionAuthContext = { token }
    const stub = createStubServer()
    registerTools(stub.server as any, config, auth)
    await stub.invoke("clickup_list_workspaces")
  }

  it("isolates ClickUp clients per session token", async () => {
    await registerAndInvoke("token-a")
    expect(createdClientKeys).toEqual(["token-a"])

    await registerAndInvoke("token-b")
    expect(createdClientKeys).toEqual(["token-a", "token-b"])
  })

  it("isolates member directory caches per session token", async () => {
    const configA = createApplicationConfig({ teamId: "team-1", apiKey: "token-a" })
    const configB = createApplicationConfig({ teamId: "team-1", apiKey: "token-b" })

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

    registerTools(stubA.server as any, configA, { token: "token-a" })
    registerTools(stubB.server as any, configB, { token: "token-b" })

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
    expect(listMembersCalls.filter((call) => call.apiKey === "token-a")).toHaveLength(1)
    expect(firstA.matches[0]?.memberId).toBe("1")

    const firstB = parse(
      await stubB.invoke("clickup_find_member_by_name", { teamId: "team-1", query: "Bob" })
    )
    expect(listMembersCalls.filter((call) => call.apiKey === "token-b")).toHaveLength(1)
    expect(firstB.matches[0]?.memberId).toBe("2")

    const secondA = parse(
      await stubA.invoke("clickup_find_member_by_name", { teamId: "team-1", query: "Alice" })
    )
    expect(listMembersCalls.filter((call) => call.apiKey === "token-a")).toHaveLength(1)
    expect(secondA.matches[0]?.memberId).toBe("1")
  })

  it("supports unauthenticated discovery but guards ClickUp tools", async () => {
    const config = createApplicationConfig({})
    const stub = createStubServer()
    registerTools(stub.server as any, config, {})

    const catalogue = await stub.invoke("tool_catalogue")
    const text = (catalogue as any)?.content?.[0]?.text
    expect(typeof text).toBe("string")

    await expect(stub.invoke("clickup_list_workspaces")).rejects.toThrow(
      /Missing ClickUp auth token/
    )
  })
})
