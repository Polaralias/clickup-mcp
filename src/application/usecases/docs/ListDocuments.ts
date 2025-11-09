import { z } from "zod"
import { ListDocumentsInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import {
  buildDocumentSummary,
  buildPageEntries,
  extractDocId,
  extractPageId,
  inferPageCount,
  resolvePreviewLimit,
  type DocumentSummary,
  type DocRecord,
  type PageEntry
} from "./docUtils.js"
import { fetchPages, resolveConcurrency, resolveWorkspaceId } from "./pageFetchUtils.js"

type Input = z.infer<typeof ListDocumentsInput>

type Result = {
  documents: Array<{
    doc: Record<string, unknown>
    summary: DocumentSummary
  }>
  truncated: boolean
  guidance?: string
}

type Filters = Record<string, string | number | boolean | undefined>

type DocEntry = {
  doc: DocRecord
  summary: DocumentSummary
}

function buildFilters(input: Input): Filters {
  return {
    search: input.search,
    space_id: input.spaceId,
    folder_id: input.folderId,
    page: input.page
  }
}

function buildDocEntry(
  doc: DocRecord,
  metadata: Record<string, unknown>[],
  previews: PageEntry[]
): DocEntry {
  const pageCount = inferPageCount(doc, metadata as Record<string, unknown>[])
  const summary = buildDocumentSummary(
    doc,
    pageCount,
    previews.map((entry) => entry.preview)
  )
  return { doc, summary }
}

export async function listDocuments(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "defaultTeamId is required to list docs"
  )
  const filters = buildFilters(input)
  const response = await client.listDocuments(workspaceId, filters)
  const docs = Array.isArray(response?.docs) ? response.docs : Array.isArray(response) ? response : []
  const limitedDocs = docs.slice(0, input.limit)

  const previewLimit = resolvePreviewLimit(config, input.previewCharLimit)
  const includePreviews = input.includePreviews ?? true

  const processor = new BulkProcessor<DocRecord, DocEntry>(resolveConcurrency())
  const entries = await processor.run(limitedDocs as DocRecord[], async (doc) => {
    const docId = extractDocId(doc)
    const pagesResponse = await client.listDocPages(docId)
    const metadata = Array.isArray(pagesResponse?.pages)
      ? (pagesResponse.pages as Record<string, unknown>[])
      : []
    const limitedMetadata = includePreviews
      ? metadata.slice(0, input.previewPageLimit)
      : []
    const previewIds = includePreviews
      ? limitedMetadata
          .map((pageRecord) => extractPageId(pageRecord))
          .filter((value): value is string => Boolean(value))
      : []
    const detailed = includePreviews ? await fetchPages(client, docId, previewIds) : []
    const entries = includePreviews
      ? buildPageEntries(
          limitedMetadata,
          detailed,
          previewLimit
        )
      : []
    return buildDocEntry(doc, metadata, entries)
  })

  const truncated = entries.some((entry) => entry.summary.truncated)
  const guidance = entries.length === 0
    ? "No docs matched. Adjust search terms or hierarchy filters."
    : "Chain clickup_get_document for a specific doc or clickup_get_document_pages to expand individual pages before editing."

  return {
    documents: entries.map((entry) => ({ doc: entry.doc, summary: entry.summary })),
    truncated,
    guidance
  }
}
