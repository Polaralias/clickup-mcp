import { z } from "zod"
import { CreateSpaceTagInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  buildColors,
  findTagByName,
  loadSpaceTags,
  normaliseHexColor,
  SpaceTagSummary,
  summariseTagFromResponse
} from "./tagShared.js"

type Input = z.infer<typeof CreateSpaceTagInput>

type Result = {
  preview?: {
    action: string
    spaceId: string
    name: string
    colors?: SpaceTagSummary["colors"]
  }
  tag?: SpaceTagSummary
  nextSteps: string[]
}

export async function createSpaceTag(input: Input, client: ClickUpClient): Promise<Result> {
  const foreground = normaliseHexColor(input.foregroundColor, "foreground")
  const background = normaliseHexColor(input.backgroundColor, "background")
  const colors = buildColors(foreground, background)

  const existing = await loadSpaceTags(input.spaceId, client)
  if (findTagByName(existing, input.name)) {
    throw new Error(`Tag \"${input.name}\" already exists in this space`)
  }

  const nextSteps = [
    "Call clickup_list_tags_for_space to refresh the space tag catalogue.",
    "Use clickup_add_tags_to_task to apply the tag to tasks."
  ]

  if (input.dryRun) {
    return {
      preview: {
        action: "create",
        spaceId: input.spaceId,
        name: input.name,
        colors
      },
      nextSteps
    }
  }

  const payload: Record<string, unknown> = { tag: input.name }
  if (foreground) payload.tag_fg = foreground
  if (background) payload.tag_bg = background

  const response = await client.createSpaceTag(input.spaceId, payload)
  const summary = summariseTagFromResponse(response, input.spaceId, {
    spaceId: input.spaceId,
    name: input.name,
    colors
  })

  return {
    tag: summary,
    nextSteps
  }
}
