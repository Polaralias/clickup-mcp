import { z } from "zod"
import { ResolveMembersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ResolveMembersInput>

type Result = {
  matches: Array<{ identifier: string; member?: Record<string, unknown> }>
}

function resolveTeamId() {
  const team = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!team) {
    throw new Error("DEFAULT_TEAM_ID is required to resolve members")
  }
  return team
}

export async function resolveMembers(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  const response = await client.listMembers(teamId)
  const members = Array.isArray(response?.members) ? response.members : []

  const matches = input.identifiers.map((identifier) => {
    const match = members.find((member: any) => {
      const id = member.id ?? member.user_id
      const email = member.email ?? member.user?.email
      const username = member.username ?? member.user?.username
      return [id, email, username].filter(Boolean).some((value) => String(value).toLowerCase() === identifier.toLowerCase())
    })
    return { identifier, member: match }
  })

  return { matches }
}
