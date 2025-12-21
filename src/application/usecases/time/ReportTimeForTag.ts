import { z } from "zod"
import { ReportTimeForTagInput } from "../../../mcp/schemas/time.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { buildTimeReport, type TimeReport, type TimeReportError } from "./TimeReportUtils.js"

type Input = z.infer<typeof ReportTimeForTagInput>

type Result = TimeReport | TimeReportError

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for time reporting")
}

export async function reportTimeForTag(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = input.teamId ?? resolveTeamId(config)
  return buildTimeReport({
    client,
    teamId,
    context: {
      contextType: "workspace",
      contextId: teamId,
      tag: input.tag,
      includeSubtasks: input.includeSubtasks !== false,
      includeTasksInMultipleLists: true,
      providedContexts: { tag: input.tag }
    },
    timeRange: { from: input.from, to: input.to },
    entryPageSize: 100,
    entryPageLimit: 10
  })
}
