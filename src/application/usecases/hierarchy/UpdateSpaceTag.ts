import { z } from "zod"
import { UpdateSpaceTagInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { SpaceTagCache } from "../../services/SpaceTagCache.js"
import {
  buildColors,
  findTagByName,
  loadSpaceTags,
  normaliseHexColor,
  SpaceTagSummary,
  summariseTagFromResponse
} from "./tagShared.js"

type Input = z.infer<typeof UpdateSpaceTagInput>

type Result = {
  preview?: {
    action: string
    spaceId: string
    name: string
    updates: Record<string, unknown>
  }
  tag?: SpaceTagSummary
  nextSteps: string[]
}

export async function updateSpaceTag(
  input: Input,
  client: ClickUpClient,
  cache: SpaceTagCache
): Promise<Result> {
  const foreground = normaliseHexColor(input.foregroundColor, "foreground")
  const background = normaliseHexColor(input.backgroundColor, "background")
  const nextSteps = [
    "Call clickup_list_tags_for_space to refresh the space tag catalogue.",
    "Update automations or filters that reference this tag if its name changed."
  ]

  const existing = await loadSpaceTags(input.spaceId, client, cache)
  const current = findTagByName(existing, input.currentName)
  if (!current) {
    throw new Error(`Tag \"${input.currentName}\" was not found in this space`)
  }

  const desiredName = input.name?.trim()
  if (desiredName) {
    const collision = findTagByName(existing, desiredName)
    const sameAsCurrent = collision && collision.name === current.name
    if (collision && !sameAsCurrent) {
      throw new Error(`Tag \"${desiredName}\" already exists in this space`)
    }
  }

  const colors = buildColors(foreground, background)
  const renameChanged = Boolean(desiredName && desiredName !== current.name)
  const hasColorUpdate = foreground !== undefined || background !== undefined
  if (!renameChanged && !hasColorUpdate) {
    throw new Error("Provide a new name or updated colours")
  }

  const updates: Record<string, unknown> = {}
  if (renameChanged) {
    updates.name = desiredName
  }
  if (colors) {
    updates.colors = colors
  }

  if (input.dryRun) {
    return {
      preview: {
        action: "update",
        spaceId: input.spaceId,
        name: current.name,
        updates
      },
      nextSteps
    }
  }

  const payload: Record<string, unknown> = {}
  if (renameChanged && desiredName) {
    payload.tag = desiredName
  }
  if (foreground !== undefined) payload.tag_fg = foreground
  if (background !== undefined) payload.tag_bg = background

  const response = await client.updateSpaceTag(input.spaceId, current.name, payload)
  const summary = summariseTagFromResponse(response, input.spaceId, {
    spaceId: input.spaceId,
    name: payload.tag ? String(payload.tag) : current.name,
    colors: buildColors(
      foreground !== undefined ? foreground : current.colors?.foreground,
      background !== undefined ? background : current.colors?.background
    )
  })

  cache.invalidate(input.spaceId)

  return {
    tag: summary,
    nextSteps
  }
}
