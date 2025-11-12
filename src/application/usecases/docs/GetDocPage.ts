import { z } from "zod"
import { GetDocPageInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"

type Input = z.infer<typeof GetDocPageInput>

type Result = {
  page: Record<string, unknown>
}

type GetDocPageOutcome = Result | DocCapabilityError

export async function getDocPage(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<GetDocPageOutcome> {
  return runWithDocsCapability(config.teamId, client, capabilityTracker, async () => {
    const page = await client.getDocPage(input.docId, input.pageId)
    return { page }
  })
}
