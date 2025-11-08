import { z } from "zod"
import { ListTimeEntriesInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { truncateList } from "../../limits/truncation.js"

type Input = z.infer<typeof ListTimeEntriesInput>

type Result = {
  entries: unknown[]
  truncated: boolean
}

function resolveTeamId() {
  const team = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!team) {
    throw new Error("DEFAULT_TEAM_ID is required for time entry listing")
  }
  return team
}

export async function listTimeEntries(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  const query: Record<string, unknown> = {
    page: input.page,
    include_task_details: true
  }
  if (input.taskId) query.task_id = input.taskId
  if (input.from) query.start_date = input.from
  if (input.to) query.end_date = input.to

  const response = await client.listTimeEntries(teamId, query)
  const entries = Array.isArray(response?.data) ? response.data : []
  const { items, truncated } = truncateList(entries, input.pageSize)
  return { entries: items, truncated }
}
