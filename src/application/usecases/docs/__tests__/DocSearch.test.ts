import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { docSearch } from "../DocSearch.js"
import { CapabilityTracker } from "../../../services/CapabilityTracker.js"
import { isDocCapabilityError } from "../../../services/DocCapability.js"
import type { DocCapabilityError } from "../../../services/DocCapability.js"

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

type DocSearchOutcome = Awaited<ReturnType<typeof docSearch>>
type DocSearchSuccess = Exclude<DocSearchOutcome, DocCapabilityError>

function ensureSuccess(outcome: DocSearchOutcome): DocSearchSuccess {
  if (isDocCapabilityError(outcome)) {
    throw new Error("Expected doc search to succeed")
  }
  return outcome
}

function extractDocId(doc: Record<string, unknown>) {
  const candidate = doc.id ?? (doc as { doc_id?: unknown }).doc_id
  if (typeof candidate !== "string") {
    throw new Error("Document missing identifier")
  }
  return candidate
}

describe("docSearch", () => {
  it("fetches additional pages when limit exceeds first page", async () => {
    const searchDocsMock = vi
      .fn()
      .mockImplementationOnce((teamId: string, params: Record<string, unknown>) => {
        expect(teamId).toBe("team-1")
        expect(params).toMatchObject({ search: "guide", page: 0 })
        return {
          docs: [
            { id: "doc-1", name: "Guide", doc_id: "doc-1" },
            { id: "doc-2", name: "Guide 2", doc_id: "doc-2" }
          ]
        }
      })
      .mockImplementationOnce((teamId: string, params: Record<string, unknown>) => {
        expect(teamId).toBe("team-1")
        expect(params).toMatchObject({ search: "guide", page: 1 })
        return {
          docs: [{ id: "doc-3", name: "Guide 3", doc_id: "doc-3" }]
        }
      })

    const client = createClient({
      searchDocs: searchDocsMock,
      listDocPages: vi.fn().mockResolvedValue({ page_listing: [] }),
      listDocuments: vi.fn().mockResolvedValue({ docs: [] })
    })
    const config = { teamId: "team-1" } as ApplicationConfig
    const tracker = new CapabilityTracker()

    const outcome = await docSearch(
      { query: "guide", limit: 3, expandPages: false },
      client,
      config,
      tracker
    )

    expect(searchDocsMock).toHaveBeenCalledTimes(2)
    const result = ensureSuccess(outcome)
    expect(result.docs.length).toBe(3)
    expect(result.guidance).toBe(
      "More docs available. Increase limit or refine the query to narrow results."
    )
  })

  it("deduplicates document ids across pages", async () => {
    const searchDocsMock = vi
      .fn()
      .mockImplementationOnce((teamId: string) => {
        expect(teamId).toBe("team-1")
        return {
          docs: [
            { id: "doc-1", name: "Guide", doc_id: "doc-1" },
            { id: "doc-2", name: "Guide 2", doc_id: "doc-2" }
          ]
        }
      })
      .mockImplementationOnce((teamId: string) => {
        expect(teamId).toBe("team-1")
        return {
          docs: [
            { id: "doc-2", name: "Guide 2", doc_id: "doc-2" },
            { id: "doc-3", name: "Guide 3", doc_id: "doc-3" }
          ]
        }
      })
      .mockImplementationOnce(() => ({ docs: [] }))

    const client = createClient({
      searchDocs: searchDocsMock,
      listDocPages: vi.fn().mockResolvedValue({ page_listing: [] }),
      listDocuments: vi.fn().mockResolvedValue({ docs: [] })
    })
    const config = { teamId: "team-1" } as ApplicationConfig
    const tracker = new CapabilityTracker()

    const outcome = await docSearch(
      { query: "guide", limit: 3, expandPages: false },
      client,
      config,
      tracker
    )

    expect(searchDocsMock).toHaveBeenCalledTimes(2)
    const result = ensureSuccess(outcome)
    const ids = result.docs.map((doc) => extractDocId(doc))
    expect(ids).toEqual(["doc-1", "doc-2", "doc-3"])
  })
})
