import { z } from "zod"
import { ResolveAssigneesInput } from "../../../mcp/schemas/members.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireDefaultTeamId } from "../../config/applicationConfig.js"
import {
  MemberDirectory,
  type MemberDirectoryCacheMetadata,
  type MemberMatch
} from "../../services/MemberDirectory.js"

type Input = z.infer<typeof ResolveAssigneesInput>

type Result = {
  results: Array<{
    identifier: string
    matches: MemberMatch[]
  }>
  cache: MemberDirectoryCacheMetadata
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireDefaultTeamId(config, "defaultTeamId is required to resolve assignees")
}

export async function resolveAssignees(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  directory: MemberDirectory
): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)
  const limit = input.limitPerIdentifier && input.limitPerIdentifier > 0 ? input.limitPerIdentifier : 5

  const { entry, cache } = await directory.prepare(teamId, () => client.listMembers(teamId), {
    forceRefresh: Boolean(input.refresh)
  })

  const results = input.identifiers.map((identifier) => ({
    identifier,
    matches: directory.rank(entry, identifier, limit)
  }))

  return { results, cache }
}

