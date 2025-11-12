import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { listDocuments } from "../ListDocuments.js"
import { CapabilityTracker } from "../../../services/CapabilityTracker.js"

function createConfig(): ApplicationConfig {
  return {
    teamId: "team-1",
    apiKey: "token",
    charLimit: 16000,
    maxAttachmentMb: 8
  }
}

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

describe("docs capability probing", () => {
  it("returns a structured not supported error when the docs endpoint is unavailable", async () => {
    const listDocumentsMock = vi
      .fn()
      .mockRejectedValue(new Error("ClickUp 404: {\"err\":{\"code\":\"not_found\"}}"))
    const client = createClient({ listDocuments: listDocumentsMock })
    const tracker = new CapabilityTracker()

    const result = await listDocuments(
      {
        workspaceId: "team-1",
        limit: 5,
        includePreviews: false,
        previewPageLimit: 1
      },
      client,
      createConfig(),
      tracker
    )

    expect(listDocumentsMock).toHaveBeenCalledTimes(1)
    expect("error" in result).toBe(true)
    if ("error" in result) {
      expect(result.error.type).toBe("not_supported")
      expect(result.error.message).toBe("Not supported in this environment")
      expect(result.error.capability.docsAvailable).toBe(false)
    }
    const capability = tracker.getDocsEndpoint("team-1")
    expect(capability?.docsAvailable).toBe(false)
  })

  it("skips repeated probes after recording an unsupported capability", async () => {
    const listDocumentsMock = vi
      .fn()
      .mockRejectedValue(new Error("ClickUp 404: {}"))
    const client = createClient({ listDocuments: listDocumentsMock })
    const tracker = new CapabilityTracker()

    await listDocuments(
      {
        workspaceId: "team-1",
        limit: 5,
        includePreviews: false,
        previewPageLimit: 1
      },
      client,
      createConfig(),
      tracker
    )

    listDocumentsMock.mockClear()

    const result = await listDocuments(
      {
        workspaceId: "team-1",
        limit: 5,
        includePreviews: false,
        previewPageLimit: 1
      },
      client,
      createConfig(),
      tracker
    )

    expect(listDocumentsMock).not.toHaveBeenCalled()
    expect("error" in result).toBe(true)
  })

  it("continues to return data when the docs endpoint is available", async () => {
    const docRecord = { id: "doc-1", doc_id: "doc-1", name: "Guide", page_count: 0 }
    const listDocumentsMock = vi.fn().mockResolvedValue({ docs: [docRecord] })
    const listDocPagesMock = vi.fn().mockResolvedValue({ page_listing: [] })
    const client = createClient({ listDocuments: listDocumentsMock, listDocPages: listDocPagesMock })
    const tracker = new CapabilityTracker()

    const result = await listDocuments(
      {
        workspaceId: "team-1",
        limit: 5,
        includePreviews: false,
        previewPageLimit: 1
      },
      client,
      createConfig(),
      tracker
    )

    expect("error" in result).toBe(false)
    if ("error" in result) {
      throw new Error("Expected successful response")
    }
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0]?.doc.id).toBe("doc-1")
    const capability = tracker.getDocsEndpoint("team-1")
    expect(capability?.docsAvailable).toBe(true)
    expect(listDocumentsMock).toHaveBeenCalledTimes(2)
  })
})
