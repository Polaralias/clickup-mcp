import { z } from "zod"
import { ListMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
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
  const response = await client.listMembers(teamId)
  return { members: response?.members ?? response }
}
