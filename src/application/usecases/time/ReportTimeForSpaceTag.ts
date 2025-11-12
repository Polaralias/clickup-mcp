import { z } from "zod"
import { ReportTimeForSpaceTagInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient, type SearchParams } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof ReportTimeForSpaceTagInput>

type Result = {
  report: Record<string, unknown>
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for time reporting")
}

export async function reportTimeForSpaceTag(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config)
  const query: SearchParams = {
    start_date: input.from,
    end_date: input.to
  }
  const path = `/team/${teamId}/time_entries/space/${encodeURIComponent(input.spaceId)}/tag/${encodeURIComponent(input.tag)}`
  const report = await client.reportTime(path, query)
  return { report }
}
