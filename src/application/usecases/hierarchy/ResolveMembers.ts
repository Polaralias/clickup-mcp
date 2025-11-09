import { z } from "zod"
import { ResolveMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireDefaultTeamId } from "../../config/applicationConfig.js"
import { memberDirectory, type MemberDirectoryCacheMetadata, type MemberMatch } from "../../services/MemberDirectory.js"

type Input = z.infer<typeof ResolveMembersInput>

type Result = {
  matches: Array<{
    identifier: string
    member?: Record<string, unknown>
    best?: MemberMatch
    candidates: MemberMatch[]
  }>
  cache: MemberDirectoryCacheMetadata
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireDefaultTeamId(config, "defaultTeamId is required to resolve members")
}

export async function resolveMembers(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)
  const { entry, cache } = await memberDirectory.prepare(teamId, () => client.listMembers(teamId), {
    forceRefresh: Boolean(input.refresh)
  })

  const limit = input.limit && input.limit > 0 ? input.limit : 5

  const matches = input.identifiers.map((identifier) => {
    const candidates = memberDirectory.rank(entry, identifier, limit)
    const bestCandidate = candidates[0]
    return {
      identifier,
      member: bestCandidate?.member,
      best: bestCandidate,
      candidates
    }
  })

  return { matches, cache }
}
