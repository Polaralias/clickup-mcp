import { z } from "zod"
import { ListDocPagesInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { runWithDocsCapability, type DocCapabilityError } from "../../services/DocCapability.js"

type Input = z.infer<typeof ListDocPagesInput>

type Result = {
  pages: unknown[]
}

type ListDocPagesOutcome = Result | DocCapabilityError

export async function listDocPages(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<ListDocPagesOutcome> {
  return runWithDocsCapability(config.teamId, client, capabilityTracker, async () => {
    const pages = await client.listDocPages(input.docId)
    return { pages: Array.isArray(pages?.pages) ? pages.pages : pages }
  })
}
