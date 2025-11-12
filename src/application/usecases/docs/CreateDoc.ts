import { z } from "zod"
import { CreateDocInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"

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
  return runWithDocsCapability(config.teamId, client, capabilityTracker, async () => {
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
      content: input.content
    }
    const doc = await client.createDoc(input.folderId, payload)
    return { doc }
  })
}
