import { z } from "zod"
import { ReportTimeForContextInput } from "../../../mcp/schemas/time.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { searchTasks } from "../tasks/SearchTasks.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import {
  buildTimeReport,
  type TimeReport,
  type TimeReportContext,
  type TimeReportError
} from "./TimeReportUtils.js"

const taskIdentityFromSearch = (candidate: unknown) => {
  if (!candidate || typeof candidate !== "object") {
    return undefined
  }
  const record = candidate as Record<string, unknown>
  const id = record.id ?? record.task_id ?? (record as any).taskId
  if (!id) {
    return undefined
  }
  const taskName = typeof record.name === "string" ? record.name : undefined
  return { id: String(id), name: taskName }
}

type Input = z.infer<typeof ReportTimeForContextInput>

type Result = TimeReport | TimeReportError

function normaliseStatuses(input: Input): string[] | undefined {
  if (input.statuses && input.statuses.length > 0) {
    return input.statuses
  }
  if (input.status) {
    return [input.status]
  }
  return undefined
}

function resolveContext(input: Input, teamId: string): TimeReportContext {
  const provided: Record<string, string | undefined> = {
    workspaceId: input.workspaceId,
    spaceId: input.spaceId,
    listId: input.listId,
    taskId: input.taskId
  }

  if (input.taskId) {
    return {
      contextType: "task",
      contextId: input.taskId,
      viewId: input.viewId,
      filterQuery: input.filterQuery,
      statuses: normaliseStatuses(input),
      tagIds: input.tagIds,
      includeSubtasks: input.includeSubtasks !== false,
      includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
      providedContexts: provided,
      guidance: input.guidance
    }
  }
  if (input.listId) {
    return {
      contextType: "list",
      contextId: input.listId,
      viewId: input.viewId,
      filterQuery: input.filterQuery,
      statuses: normaliseStatuses(input),
      tagIds: input.tagIds,
      includeSubtasks: input.includeSubtasks !== false,
      includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
      providedContexts: provided,
      guidance: input.guidance
    }
  }
  if (input.spaceId) {
    return {
      contextType: "space",
      contextId: input.spaceId,
      viewId: input.viewId,
      filterQuery: input.filterQuery,
      statuses: normaliseStatuses(input),
      tagIds: input.tagIds,
      includeSubtasks: input.includeSubtasks !== false,
      includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
      providedContexts: provided,
      guidance: input.guidance
    }
  }
  return {
    contextType: "workspace",
    contextId: input.workspaceId ?? teamId,
    viewId: input.viewId,
    filterQuery: input.filterQuery,
    statuses: normaliseStatuses(input),
    tagIds: input.tagIds,
    includeSubtasks: input.includeSubtasks !== false,
    includeTasksInMultipleLists: input.includeTasksInMultipleLists !== false,
    providedContexts: provided,
    guidance: input.guidance
  }
}

function needsTaskSampling(context: TimeReportContext): boolean {
  return context.contextType === "list" && Boolean(context.filterQuery || context.statuses || context.tagIds || context.viewId)
}

export async function reportTimeForContext(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const teamId = requireTeamId(config, "teamId is required for time reporting")
  const context = resolveContext(input, teamId)
  const timeRange = { from: input.from, to: input.to }

  const statuses = normaliseStatuses(input)
  const filtersTruncated: string[] = []
  let allowedTaskIds: Set<string> | undefined

  if (needsTaskSampling(context)) {
    const taskSearch = await searchTasks(
      {
        page: input.taskPage ?? 0,
        pageSize: input.taskSampleSize ?? 50,
        query: input.filterQuery,
        listIds: [context.contextId],
        tagIds: input.tagIds,
        includeTasksInMultipleLists: context.includeTasksInMultipleLists,
        includeSubtasks: context.includeSubtasks,
        statuses
      },
      client,
      config,
      catalogue
    )
    const taskIds = (taskSearch.results ?? [])
      .map((task) => taskIdentityFromSearch(task))
      .filter((task): task is { id: string; name?: string } => Boolean(task))
      .map((task) => task.id)
    allowedTaskIds = new Set(taskIds)
    if (taskSearch.truncated) {
      filtersTruncated.push(
        "Task sampling for the filtered list was truncated; increase taskSampleSize or paginate taskPage for full coverage"
      )
    }
    if (taskIds.length === 0) {
      return {
        error: {
          type: "no_results",
          message: "Filter matched zero tasks in the selected list",
          details: {
            context,
            timeRange,
            filters: {
              filterQuery: input.filterQuery,
              statuses,
              tagIds: input.tagIds
            }
          }
        }
      }
    }
  }

  const result = await buildTimeReport({
    client,
    teamId,
    context: { ...context, statuses, tagIds: input.tagIds },
    timeRange,
    allowedTaskIds,
    entryPageSize: input.entryPageSize,
    entryPageLimit: input.entryPageLimit
  })

  if ("error" in result) {
    return result
  }

  const partialReasons = new Set(result.partialReasons ?? [])
  filtersTruncated.forEach((reason) => partialReasons.add(reason))
  return {
    ...result,
    partial: partialReasons.size > 0,
    partialReasons: partialReasons.size > 0 ? Array.from(partialReasons) : undefined
  }
}
