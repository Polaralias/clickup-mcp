import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { docSearch } from "../DocSearch.js"
import { bulkDocSearch } from "../BulkDocSearch.js"
import { createDoc } from "../CreateDoc.js"
import { createDocumentPage } from "../CreateDocumentPage.js"
import { updateDocPage } from "../UpdateDocPage.js"
import { DocSearchCache } from "../../../services/DocSearchCache.js"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"

const config: ApplicationConfig = {
  teamId: "team-1",
  apiKey: "token-1",
  charLimit: 16000,
  maxAttachmentMb: 8
}

function createClient() {
  return {
    searchDocs: vi.fn(),
    listDocPages: vi.fn(),
    createDoc: vi.fn(),
    createDocumentPage: vi.fn(),
    updateDocPage: vi.fn()
  } as unknown as ClickUpClient
}

describe("DocSearchCache integration", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("reuses cached doc search responses when TTL active", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any).mockResolvedValue({
      docs: [{ id: "doc-1", name: "Alpha" }]
    })

    const first = await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)
    const second = await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)

    expect(client.searchDocs).toHaveBeenCalledTimes(1)
    expect(first.docs).toEqual(second.docs)
  })

  it("reuses cached expanded pages for repeated lookups", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any).mockResolvedValue({
      docs: [{ id: "doc-1", name: "Alpha" }]
    })
    ;(client.listDocPages as any).mockResolvedValue({
      pages: [{ id: "page-1", name: "Root" }]
    })

    const first = await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)
    const second = await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)

    expect(client.searchDocs).toHaveBeenCalledTimes(1)
    expect(client.listDocPages).toHaveBeenCalledTimes(1)
    expect(second.expandedPages?.["doc-1"]).toEqual(first.expandedPages?.["doc-1"])
  })

  it("refreshes entries once TTL expires", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(0))
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 1000 })

    ;(client.searchDocs as any)
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })

    await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)
    expect(client.searchDocs).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1500)

    await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)
    expect(client.searchDocs).toHaveBeenCalledTimes(2)
  })

  it("supports force refreshing via bulk doc search", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any)
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })

    await bulkDocSearch({ queries: ["alpha"], limit: 5, expandPages: false }, client, config, cache)
    expect(client.searchDocs).toHaveBeenCalledTimes(1)

    await bulkDocSearch({ queries: ["alpha"], limit: 5, expandPages: false, forceRefresh: true }, client, config, cache)
    expect(client.searchDocs).toHaveBeenCalledTimes(2)
  })

  it("invalidates cached queries after doc creation", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any)
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }, { id: "doc-2", name: "Bravo" }] })
    ;(client.createDoc as any).mockResolvedValue({ id: "doc-2", name: "Bravo" })

    await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)
    await createDoc({ folderId: "folder-1", name: "Bravo" }, client, cache)
    await docSearch({ query: "alpha", limit: 5, expandPages: false }, client, config, cache)

    expect(client.searchDocs).toHaveBeenCalledTimes(2)
  })

  it("invalidates cached doc data after page creation", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any)
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
    ;(client.listDocPages as any).mockResolvedValue({ pages: [{ id: "page-1", name: "Intro" }] })
    ;(client.createDocumentPage as any).mockResolvedValue({ id: "page-2", name: "New" })

    await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)
    await createDocumentPage({ docId: "doc-1", title: "New", content: "Body" }, client, config, cache)
    await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)

    expect(client.searchDocs).toHaveBeenCalledTimes(2)
    expect(client.listDocPages).toHaveBeenCalledTimes(2)
  })

  it("invalidates cached doc data after page updates", async () => {
    const client = createClient()
    const cache = new DocSearchCache({ ttlMs: 60_000 })

    ;(client.searchDocs as any)
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
      .mockResolvedValueOnce({ docs: [{ id: "doc-1", name: "Alpha" }] })
    ;(client.listDocPages as any)
      .mockResolvedValue({ pages: [{ id: "page-1", name: "Intro" }] })
    ;(client.updateDocPage as any).mockResolvedValue({ id: "page-1", name: "Intro" })

    await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)
    await updateDocPage({ docId: "doc-1", pageId: "page-1", content: "Updated" }, client, cache)
    await docSearch({ query: "alpha", limit: 5, expandPages: true }, client, config, cache)

    expect(client.searchDocs).toHaveBeenCalledTimes(2)
    expect(client.listDocPages).toHaveBeenCalledTimes(2)
  })
})
