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

function normaliseLimit(rawLimit: number) {
  return Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10
}

function buildPageSignature(records: TaskResolutionRecord[]) {
  const ids = records
    .map((record) => record.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  if (ids.length === 0) {
    return undefined
  }
  return ids.join("|")
}

async function loadSearchPage(
  teamId: string,
  params: Record<string, unknown>,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
) {
  const cached = catalogue?.getSearchEntry(teamId, params)
  if (cached) {
    return cached.records
  }
  const response = await client.searchTasks(teamId, params)
  const tasks = Array.isArray(response?.tasks) ? response.tasks : []
  const records = toRecords(tasks)
  const index = new TaskSearchIndex()
  index.index(records)
  catalogue?.storeSearchEntry({ teamId, params, tasks, records, index })
  return records
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
  const limit = normaliseLimit(input.limit)

  if (taskIdPattern.test(input.query)) {
    const params = { task_ids: input.query }
    const cached = catalogue?.getSearchEntry(teamId, params)
    if (cached) {
      return { results: cached.records.slice(0, limit) }
    }
    const response = await client.searchTasks(teamId, params)
    const tasks = Array.isArray(response?.tasks) ? response.tasks : []
    const records = toRecords(tasks)
    const index = new TaskSearchIndex()
    index.index(records)
    catalogue?.storeSearchEntry({ teamId, params, tasks, records, index })
    return { results: records.slice(0, limit) }
  }

  const aggregateIndex = new TaskSearchIndex()
  const aggregated: TaskResolutionRecord[] = []
  const seenIds = new Set<string>()
  const seenSignatures = new Set<string>()
  let exhausted = false

  for (let page = 0; aggregated.length < limit; page += 1) {
    const params = { search: input.query, page }
    const records = await loadSearchPage(teamId, params, client, catalogue)
    if (records.length === 0) {
      exhausted = true
      break
    }

    const signature = buildPageSignature(records)
    if (signature && seenSignatures.has(signature)) {
      exhausted = true
      break
    }
    if (signature) {
      seenSignatures.add(signature)
    }

    const newRecords = records.filter((record) => {
      const id = record.id
      if (typeof id === "string" && id.length > 0) {
        if (seenIds.has(id)) {
          return false
        }
        seenIds.add(id)
      }
      return true
    })

    if (newRecords.length === 0) {
      exhausted = true
      break
    }

    aggregateIndex.index(newRecords)
    aggregated.push(...newRecords)
  }

  const results = aggregateIndex.search(input.query, limit)

  let guidance: string | undefined
  if (results.length === 0) {
    guidance = "No fuzzy matches. Try a more specific query or use search."
  } else if (!exhausted && aggregated.length >= limit) {
    guidance = "More matches available. Increase limit or paginate through search results."
  }

  return { results, guidance }
}
