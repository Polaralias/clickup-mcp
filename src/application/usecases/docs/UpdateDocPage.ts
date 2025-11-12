import { z } from "zod"
import { UpdateDocPageInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"
import { resolveWorkspaceId } from "./pageFetchUtils.js"

type Input = z.infer<typeof UpdateDocPageInput>

type Result = {
  preview?: Record<string, unknown>
  page?: Record<string, unknown>
}

type UpdateDocPageOutcome = Result | DocCapabilityError

export async function updateDocPage(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<UpdateDocPageOutcome> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "teamId is required to update doc pages"
  )
  return runWithDocsCapability(workspaceId, client, capabilityTracker, async () => {
    const payload: Record<string, unknown> = {}
    if (input.title !== undefined) payload.name = input.title
    if (input.content !== undefined) payload.content = input.content

    if (input.dryRun) {
      return { preview: { docId: input.docId, pageId: input.pageId, fields: Object.keys(payload) } }
    }

    const page = await client.updateDocPage(input.docId, input.pageId, payload)
    return { page }
  })
}
