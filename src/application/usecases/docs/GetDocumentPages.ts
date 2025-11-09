import { z } from "zod"
import { GetDocumentPagesInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import {
  buildDocumentSummary,
  buildPageEntries,
  extractDocId,
  inferPageCount,
  resolvePreviewLimit,
  type DocumentSummary,
  type DocRecord,
  type PageEntry
} from "./docUtils.js"
import { fetchPages, orderMetadata, resolveWorkspaceId } from "./pageFetchUtils.js"

type Input = z.infer<typeof GetDocumentPagesInput>

type Result = {
  doc: Record<string, unknown>
  summary: DocumentSummary
  pages: PageEntry[]
  truncated: boolean
  guidance?: string
}

export async function getDocumentPages(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "defaultTeamId is required to fetch doc pages"
  )
  const docResponse = await client.getDocument(workspaceId, input.docId)
  const doc = (docResponse?.doc ?? docResponse ?? {}) as DocRecord
  const docId = extractDocId(doc)

  const metadataResponse = await client.listDocPages(docId)
  const metadataAll = Array.isArray(metadataResponse?.pages) ? metadataResponse.pages : []
  const orderedMetadata = orderMetadata(metadataAll as Record<string, unknown>[], input.pageIds)

  const previewLimit = resolvePreviewLimit(config, input.previewCharLimit)
  const explicitIds = Array.from(new Set(input.pageIds))
  const detailedPages = await fetchPages(client, docId, explicitIds)
  const pageEntries = buildPageEntries(
    orderedMetadata as Record<string, unknown>[],
    detailedPages,
    previewLimit
  )

  const pageCount = inferPageCount(doc, metadataAll as Record<string, unknown>[])
  const summary = buildDocumentSummary(
    doc,
    pageCount,
    pageEntries.map((entry) => entry.preview)
  )

  const truncated = summary.truncated
  const guidance = truncated
    ? "Previews were truncated for token safety. Request fewer pages or chain another call for additional content."
    : "Content is ready for review. Chain clickup_update_doc_page for edits or call again with more pageIds to expand context."

  return {
    doc,
    summary,
    pages: pageEntries,
    truncated,
    guidance
  }
}
