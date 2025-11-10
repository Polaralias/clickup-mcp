import { z } from "zod"
import { FindMemberByNameInput } from "../../../mcp/schemas/members.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { memberDirectory, type MemberDirectoryCacheMetadata, type MemberMatch } from "../../services/MemberDirectory.js"

type Input = z.infer<typeof FindMemberByNameInput>

type Result = {
  query: string
  matches: MemberMatch[]
  cache: MemberDirectoryCacheMetadata
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireTeamId(config, "teamId is required to search members")
}

export async function findMemberByName(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)
  const limit = input.limit && input.limit > 0 ? input.limit : 5

  const { matches, cache } = await memberDirectory.search(
    teamId,
    input.query,
    () => client.listMembers(teamId),
    {
      forceRefresh: Boolean(input.refresh),
      limit
    }
  )

  return { query: input.query, matches, cache }
}

