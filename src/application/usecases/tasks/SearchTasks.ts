import { z } from "zod"
import { SearchTasksInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { truncateList } from "../../limits/truncation.js"

type Input = z.infer<typeof SearchTasksInput>

type Result = {
  results: unknown[]
  truncated: boolean
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for task search")
}

export async function searchTasks(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config)
  const query: Record<string, unknown> = {
    page: input.page,
    order_by: "updated",
    reverse: true
  }
  if (input.query) query.search = input.query
  if (input.listIds) query.list_ids = input.listIds.join(",")
  if (input.tagIds) query.tags = input.tagIds.join(",")
  if (input.status) query.statuses = input.status

  const response = await client.searchTasks(teamId, query)
  const tasks = Array.isArray(response?.tasks) ? response.tasks : []
  const { items, truncated } = truncateList(tasks, input.pageSize)
  return { results: items, truncated }
}
