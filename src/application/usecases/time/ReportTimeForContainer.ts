import { z } from "zod"
import { ReportTimeForContainerInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ReportTimeForContainerInput>

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

export async function reportTimeForContainer(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  const query: Record<string, unknown> = {
    start_date: input.from,
    end_date: input.to
  }
  const path = `/team/${teamId}/time_entries/container/${encodeURIComponent(input.containerId)}`
  const report = await client.reportTime(path, query)
  return { report }
}
