import { describe, expect, it } from "vitest"

import { listMembers } from "../ListMembers.js"
import { CapabilityTracker } from "../../../services/CapabilityTracker.js"
import { ClickUpMembersFallbackError } from "../../../../infrastructure/clickup/ClickUpClient.js"

const config = {
  teamId: "123",
  apiKey: "token",
  charLimit: 16000,
  maxAttachmentMb: 8
}

describe("listMembers", () => {
  it("returns members and capability metadata when the direct endpoint succeeds", async () => {
    const tracker = new CapabilityTracker()
    const client = {
      listMembers: async () => ({ members: [{ id: "1" }], source: "direct" as const })
    }

    const result = await listMembers({ teamId: "123" }, client as any, config, tracker)

    expect(result.members).toEqual([{ id: "1" }])
    expect(result.guidance).toBeUndefined()
    expect(result.capabilities?.memberEndpoint.directAvailable).toBe(true)
    expect(result.capabilities?.memberEndpoint.teamId).toBe("123")
    expect(result.capabilities?.memberEndpoint.lastChecked).toMatch(/^\d{4}-/)
  })

  it("provides guidance and marks the capability when the fallback is used", async () => {
    const tracker = new CapabilityTracker()
    const client = {
      listMembers: async () => ({
        members: [{ id: "2" }],
        source: "fallback" as const,
        diagnostics: "status=404"
      })
    }

    const result = await listMembers({ teamId: "123" }, client as any, config, tracker)

    expect(result.members).toEqual([{ id: "2" }])
    expect(result.guidance).toContain("Direct member listing returned 404")
    expect(result.capabilities?.memberEndpoint.directAvailable).toBe(false)
    expect(result.capabilities?.memberEndpoint.diagnostics).toBe("status=404")
  })

  it("records an unavailable capability when both direct and fallback calls fail", async () => {
    const tracker = new CapabilityTracker()
    const error = new ClickUpMembersFallbackError("123", undefined, { cause: new Error("no workspace") })
    const client = {
      listMembers: async () => {
        throw error
      }
    }

    await expect(listMembers({ teamId: "123" }, client as any, config, tracker)).rejects.toThrow(
      /Both the \/team\/123\/member endpoint and the \/team fallback failed/
    )

    const capability = tracker.getMemberEndpoint("123")
    expect(capability?.directAvailable).toBe(false)
    expect(capability?.diagnostics).toBe("no workspace")
  })
})
