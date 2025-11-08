import { z } from "zod"
import { FuzzySearchInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { TaskSearchIndex } from "../../services/TaskSearchIndex.js"

const taskIdPattern = /^[0-9]+$/

type Input = z.infer<typeof FuzzySearchInput>

type Result = {
  results: Array<Record<string, unknown>>
  guidance?: string
}

function resolveTeamId() {
  const team = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!team) {
    throw new Error("DEFAULT_TEAM_ID is required for fuzzy search")
  }
  return team
}

export async function fuzzySearch(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  if (taskIdPattern.test(input.query)) {
    const response = await client.searchTasks(teamId, { task_ids: input.query })
    const tasks = Array.isArray(response?.tasks) ? response.tasks : []
    return { results: tasks.slice(0, input.limit) }
  }

  const response = await client.searchTasks(teamId, { search: input.query, page: 0 })
  const tasks = Array.isArray(response?.tasks) ? response.tasks : []
  const index = new TaskSearchIndex()
  index.index(
    tasks.map((task: any) => ({
      id: task.id ?? task.task_id ?? "",
      name: task.name ?? "",
      description: task.description ?? "",
      status: task.status?.status,
      updatedAt: task.date_updated ? Number(task.date_updated) : undefined
    }))
  )
  const results = index.search(input.query, input.limit)
  return {
    results,
    guidance: results.length === 0 ? "No fuzzy matches. Try a more specific query or use search." : undefined
  }
}
