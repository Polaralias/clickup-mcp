import { z } from "zod"
import { UpdateTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type Input = z.infer<typeof UpdateTaskInput>

type Result = {
  preview?: Record<string, unknown>
  task?: Record<string, unknown>
}

export async function updateTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.description !== undefined) payload.description = input.description
  if (input.status !== undefined) payload.status = input.status
  if (input.priority !== undefined) payload.priority = input.priority
  if (input.dueDate !== undefined) payload.due_date = input.dueDate
  if (input.assigneeIds !== undefined) payload.assignees = input.assigneeIds
  if (input.tags !== undefined) payload.tags = input.tags
  if (input.parentTaskId !== undefined) payload.parent = input.parentTaskId

  if (input.dryRun) {
    return { preview: { taskId: input.taskId, fields: Object.keys(payload) } }
  }

  const task = await client.updateTask(input.taskId, payload)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()
  return { task }
}
