import { z } from "zod"
import { ListMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListMembersInput>

type Result = {
  members: unknown[]
}

function resolveTeamId(teamId?: string) {
  if (teamId) return teamId
  const fallback = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!fallback) {
    throw new Error("DEFAULT_TEAM_ID is required when teamId is not provided")
  }
  return fallback
}

export async function listMembers(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId(input.teamId)
  const response = await client.listMembers(teamId)
  return { members: response?.members ?? response }
}
