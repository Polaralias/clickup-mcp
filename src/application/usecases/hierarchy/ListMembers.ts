import { z } from "zod"
import { ListMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient, ClickUpMembersFallbackError } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof ListMembersInput>

type Result = {
  members: unknown[]
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireTeamId(config, "teamId is required when a tool input does not provide one")
}

export async function listMembers(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)

  try {
    const response = await client.listMembers(teamId)
    return { members: response?.members ?? response }
  } catch (error) {
    if (error instanceof ClickUpMembersFallbackError) {
      const detail = error.cause instanceof Error ? error.cause.message : undefined
      const suffix = detail ? ` Underlying error: ${detail}` : ""
      throw new Error(
        `Failed to list members for workspace ${teamId}. Both the /team/${teamId}/member endpoint and the /team fallback failed. Verify the workspace exists and is shared with the configured ClickUp API token.${suffix}`
      )
    }
    throw error
  }
}
