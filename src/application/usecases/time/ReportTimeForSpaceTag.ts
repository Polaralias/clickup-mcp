import { z } from "zod"
import { ReportTimeForSpaceTagInput } from "../../../mcp/schemas/time.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { buildTimeReport, type TimeReport, type TimeReportError } from "./TimeReportUtils.js"

type Input = z.infer<typeof ReportTimeForSpaceTagInput>

type Result = TimeReport | TimeReportError

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for time reporting")
}

export async function reportTimeForSpaceTag(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config)
  return buildTimeReport({
    client,
    teamId,
    context: {
      contextType: "space",
      contextId: input.spaceId,
      tag: input.tag,
      includeSubtasks: input.includeSubtasks !== false,
      includeTasksInMultipleLists: true,
      providedContexts: { spaceId: input.spaceId, tag: input.tag }
    },
    timeRange: { from: input.from, to: input.to },
    entryPageSize: 100,
    entryPageLimit: 10
  })
}
