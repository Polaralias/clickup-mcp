import { z } from "zod"
import { DeleteSpaceTagInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { findTagByName, loadSpaceTags, SpaceTagSummary } from "./tagShared.js"

type Input = z.infer<typeof DeleteSpaceTagInput>

type Result = {
  preview?: {
    action: string
    spaceId: string
    name: string
  }
  removedTag?: SpaceTagSummary
  status?: string
  nextSteps: string[]
}

export async function deleteSpaceTag(input: Input, client: ClickUpClient): Promise<Result> {
  const existing = await loadSpaceTags(input.spaceId, client)
  const current = findTagByName(existing, input.name)
  if (!current) {
    throw new Error(`Tag \"${input.name}\" was not found in this space`)
  }

  const nextSteps = [
    "Call clickup_list_tags_for_space to refresh the space tag catalogue.",
    "Update saved searches or automations that referenced this tag."
  ]

  if (input.dryRun) {
    return {
      preview: {
        action: "delete",
        spaceId: input.spaceId,
        name: current.name
      },
      nextSteps
    }
  }

  await client.deleteSpaceTag(input.spaceId, current.name)

  return {
    removedTag: current,
    status: "deleted",
    nextSteps
  }
}
