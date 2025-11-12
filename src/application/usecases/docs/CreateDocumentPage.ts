import { z } from "zod"
import { CreateDocumentPageInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"
import { buildContentPreview, resolvePreviewLimit } from "./docUtils.js"

type Input = z.infer<typeof CreateDocumentPageInput>

type Result = {
  preview?: {
    docId: string
    title: string
    parentId?: string
    position?: number
    contentPreview?: string
    truncated: boolean
  }
  page?: Record<string, unknown>
  guidance?: string
}

type CreateDocumentPageOutcome = Result | DocCapabilityError

export async function createDocumentPage(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<CreateDocumentPageOutcome> {
  const previewLimit = resolvePreviewLimit(config)
  const content = input.content ?? ""
  const { preview, truncated } = buildContentPreview(content, previewLimit)
  const basePreview = {
    docId: input.docId,
    title: input.title,
    parentId: input.parentId,
    position: input.position,
    contentPreview: preview,
    truncated
  }

  return runWithDocsCapability(config.teamId, client, capabilityTracker, async () => {
    if (input.dryRun) {
      return {
        preview: basePreview,
        guidance: "Dry run complete. Set confirm to 'yes' to create the page, then chain clickup_get_document_pages to verify."
      }
    }

    const payload: Record<string, unknown> = { name: input.title }
    if (input.content !== undefined) {
      payload.content = input.content
    }
    if (input.parentId) {
      payload.parent = input.parentId
    }
    if (input.position !== undefined) {
      payload.orderindex = input.position
    }

    const page = await client.createDocumentPage(input.docId, payload)
    return {
      preview: basePreview,
      page,
      guidance:
        "Page created. Chain clickup_get_document to refresh summaries or clickup_get_document_pages for the new body."
    }
  })
}
