import { z } from "zod"
import { GetDocumentInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import {
  buildDocumentSummary,
  buildPageEntries,
  extractDocId,
  extractPageId,
  inferPageCount,
  resolvePreviewLimit,
  type DocumentSummary,
  type DocRecord,
  type PageEntry,
  type PagePreview
} from "./docUtils.js"
import {
  fetchPages,
  orderMetadata,
  resolveWorkspaceId
} from "./pageFetchUtils.js"

type Input = z.infer<typeof GetDocumentInput>

type Result = {
  doc: Record<string, unknown>
  summary: DocumentSummary
  pages?: Array<{
    page: Record<string, unknown>
    preview: PagePreview
  }>
  truncated: boolean
  guidance?: string
}

type PageRecord = Record<string, unknown>

export async function getDocument(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "defaultTeamId is required to fetch docs"
  )
  const response = await client.getDocument(workspaceId, input.docId)
  const doc = (response?.doc ?? response ?? {}) as DocRecord
  const docId = extractDocId(doc)

  const pagesResponse = await client.listDocPages(docId)
  const metadataAll = Array.isArray(pagesResponse?.pages) ? pagesResponse.pages : []
  const orderedMetadata = orderMetadata(metadataAll as PageRecord[], input.pageIds)
  const limitedMetadata =
    Array.isArray(input.pageIds) && input.pageIds.length > 0
      ? orderedMetadata
      : orderedMetadata.slice(0, input.pageLimit)

  const previewLimit = resolvePreviewLimit(config, input.previewCharLimit)
  const includePages = input.includePages ?? true

  const fetchIds = includePages
    ? limitedMetadata
        .map((page) => extractPageId(page as PageRecord))
        .filter((value): value is string => Boolean(value))
    : []
  const detailed = includePages ? await fetchPages(client, docId, fetchIds) : []
  const pageEntries = includePages
    ? buildPageEntries(
        limitedMetadata as Record<string, unknown>[],
        detailed,
        previewLimit
      )
    : []
  const pagePreviews = pageEntries.map((entry) => entry.preview)

  const pageCount = inferPageCount(doc, metadataAll as PageRecord[])
  const summary = buildDocumentSummary(doc, pageCount, pagePreviews)

  const truncated = summary.truncated
  const guidance = truncated
    ? "Page previews were truncated. Chain clickup_get_document_pages for specific bodies or clickup_update_doc_page before editing."
    : "Use clickup_get_document_pages for targeted page bodies or clickup_create_document_page to add new content."

  return {
    doc,
    summary,
    pages: includePages ? pageEntries : undefined,
    truncated,
    guidance
  }
}
