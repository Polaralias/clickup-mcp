import { z } from "zod"
import { CreateDocInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"
import { resolveWorkspaceId } from "./pageFetchUtils.js"

type Input = z.infer<typeof CreateDocInput>

type Result = {
  preview?: Record<string, unknown>
  doc?: Record<string, unknown>
}

export async function createDoc(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<Result | DocCapabilityError> {
  const workspaceId = resolveWorkspaceId(
    input.workspaceId,
    config,
    "teamId is required to create docs"
  )
  return runWithDocsCapability(workspaceId, client, capabilityTracker, async () => {
    if (input.dryRun) {
      return {
        preview: {
          folderId: input.folderId,
          name: input.name,
          hasContent: Boolean(input.content)
        }
      }
    }

    const payload: Record<string, unknown> = {
      name: input.name,
      folder_id: input.folderId
    }
    if (input.content !== undefined) {
      payload.content = input.content
    }
    const doc = await client.createDoc(workspaceId, payload)
    return { doc }
  })
}
