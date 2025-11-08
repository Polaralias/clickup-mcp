import { z } from "zod"
import { ListMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireDefaultTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof ListMembersInput>

type Result = {
  members: unknown[]
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireDefaultTeamId(config, "defaultTeamId is required when teamId is not provided")
}

export async function listMembers(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)
  const response = await client.listMembers(teamId)
  return { members: response?.members ?? response }
}
