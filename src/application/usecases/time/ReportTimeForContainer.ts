import { z } from "zod"
import { ReportTimeForContainerInput } from "../../../mcp/schemas/time.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { buildTimeReport, type TimeReport, type TimeReportError } from "./TimeReportUtils.js"

type Input = z.infer<typeof ReportTimeForContainerInput>

type Result = TimeReport | TimeReportError

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for time reporting")
}

export async function reportTimeForContainer(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config)
  const context = {
    contextType: input.containerType,
    contextId: input.containerId,
    includeSubtasks: input.includeSubtasks !== false,
    includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
    providedContexts: {
      containerId: input.containerId,
      containerType: input.containerType
    }
  } as const

  return buildTimeReport({
    client,
    teamId,
    context,
    timeRange: { from: input.from, to: input.to },
    entryPageSize: 100,
    entryPageLimit: 10
  })
}
