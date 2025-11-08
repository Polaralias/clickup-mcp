import { z } from "zod"
import { ReportTimeForTagInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ReportTimeForTagInput>

type Result = {
  report: Record<string, unknown>
}

function resolveTeamId() {
  const team = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!team) {
    throw new Error("DEFAULT_TEAM_ID is required for time reporting")
  }
  return team
}

export async function reportTimeForTag(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  const query: Record<string, unknown> = {
    start_date: input.from,
    end_date: input.to
  }
  const path = `/team/${teamId}/time_entries/tag/${encodeURIComponent(input.tag)}`
  const report = await client.reportTime(path, query)
  return { report }
}
