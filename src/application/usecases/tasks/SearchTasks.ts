import { z } from "zod"
import { SearchTasksInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { SearchParams as ClickUpSearchParams } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { truncateList } from "../../limits/truncation.js"
import { TaskSearchIndex } from "../../services/TaskSearchIndex.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import { normaliseTaskRecord } from "./resolveTaskReference.js"
import type { TaskResolutionRecord } from "./resolveTaskReference.js"

type Input = z.infer<typeof SearchTasksInput>

type Result = {
  results: unknown[]
  truncated: boolean
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for task search")
}

function normaliseStatuses(input: Input): string[] | undefined {
  if (input.statuses && input.statuses.length > 0) {
    return input.statuses
  }
  if (input.status) {
    return [input.status]
  }
  return undefined
}

export async function searchTasks(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const teamId = resolveTeamId(config)
  const query: ClickUpSearchParams = {
    page: input.page,
    order_by: "updated",
    reverse: true,
    subtasks: input.includeSubtasks
  }
  if (input.query) query.search = input.query
  if (input.listIds) query.list_ids = input.listIds.join(",")
  if (input.tagIds) query.tags = input.tagIds.join(",")
  const statuses = normaliseStatuses(input)
  if (statuses) query.statuses = statuses

  const cached = catalogue?.getSearchEntry(teamId, query)

  let tasks: unknown[]

  if (cached) {
    tasks = cached.tasks
  } else {
    const response = await client.searchTasks(teamId, query)
    tasks = Array.isArray(response?.tasks) ? response.tasks : []
    const records: TaskResolutionRecord[] = tasks
      .map((task) => normaliseTaskRecord(task))
      .filter((task): task is TaskResolutionRecord => Boolean(task))
    const index = new TaskSearchIndex()
    index.index(records)
    catalogue?.storeSearchEntry({ teamId, params: query, tasks, records, index })
  }

  const { items, truncated } = truncateList(tasks, input.pageSize)
  return { results: items, truncated }
}
