import { z } from "zod"
import { FuzzySearchInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { TaskSearchIndex } from "../../services/TaskSearchIndex.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import { normaliseTaskRecord } from "./resolveTaskReference.js"
import type { TaskResolutionRecord } from "./resolveTaskReference.js"

const taskIdPattern = /^[0-9]+$/

type Input = z.infer<typeof FuzzySearchInput>

type Result = {
  results: Array<TaskResolutionRecord & { score?: number }>
  guidance?: string
}

function toRecords(candidates: unknown[]): TaskResolutionRecord[] {
  return candidates
    .map((task) => normaliseTaskRecord(task))
    .filter((task): task is TaskResolutionRecord => Boolean(task))
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for fuzzy search")
}

export async function fuzzySearch(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const teamId = resolveTeamId(config)
  if (taskIdPattern.test(input.query)) {
    const params = { task_ids: input.query }
    const cached = catalogue?.getSearchEntry(teamId, params)
    if (cached) {
      return { results: cached.records.slice(0, input.limit) }
    }
    const response = await client.searchTasks(teamId, params)
    const tasks = Array.isArray(response?.tasks) ? response.tasks : []
    const records = toRecords(tasks)
    const index = new TaskSearchIndex()
    index.index(records)
    catalogue?.storeSearchEntry({ teamId, params, tasks, records, index })
    return { results: records.slice(0, input.limit) }
  }

  const params = { search: input.query, page: 0 }
  const cached = catalogue?.getSearchEntry(teamId, params)

  let index: TaskSearchIndex
  let results: ReturnType<TaskSearchIndex["search"]>

  if (cached) {
    index = cached.index
    results = index.search(input.query, input.limit)
  } else {
    const response = await client.searchTasks(teamId, params)
    const tasks = Array.isArray(response?.tasks) ? response.tasks : []
    const records = toRecords(tasks)
    index = new TaskSearchIndex()
    index.index(records)
    catalogue?.storeSearchEntry({ teamId, params, tasks, records, index })
    results = index.search(input.query, input.limit)
  }

  return {
    results,
    guidance: results.length === 0 ? "No fuzzy matches. Try a more specific query or use search." : undefined
  }
}
