import { z } from "zod"
import { GetDocumentPagesInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"
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
import {
  extractPageListing,
  fetchPages,
  orderMetadata,
  resolveWorkspaceId
} from "./pageFetchUtils.js"

type Input = z.infer<typeof GetDocumentPagesInput>

type Result = {
  doc: Record<string, unknown>
  summary: DocumentSummary
  pages: PageEntry[]
  truncated: boolean
  guidance?: string
}

type GetDocumentPagesOutcome = Result | DocCapabilityError

export async function getDocumentPages(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<GetDocumentPagesOutcome> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "teamId is required to fetch doc pages"
  )
  return runWithDocsCapability(workspaceId, client, capabilityTracker, async () => {
    const docResponse = await client.getDocument(workspaceId, input.docId)
    const doc = (docResponse?.doc ?? docResponse ?? {}) as DocRecord
    const docId = extractDocId(doc)

    const metadataResponse = await client.listDocPages(docId)
    const metadataAll = extractPageListing(metadataResponse)
    const orderedMetadata = orderMetadata(metadataAll as Record<string, unknown>[], input.pageIds)

    const previewLimit = resolvePreviewLimit(config, input.previewCharLimit)
    const detailedPages = await fetchPages(client, docId, input.pageIds)
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
  })
}
