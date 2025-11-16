import { z } from "zod"
import { CreateTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type BaseInput = z.infer<typeof CreateTaskInput>
type Input = BaseInput & { parentTaskId?: string }

type Result = {
  preview?: Record<string, unknown>
  task?: Record<string, unknown>
}

export async function createTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  if (input.dryRun) {
    return {
      preview: {
        listId: input.listId,
        name: input.name,
        hasDescription: Boolean(input.description),
        assigneeCount: input.assigneeIds?.length ?? 0,
        tagCount: input.tags?.length ?? 0,
        parentTaskId: input.parentTaskId
      }
    }
  }

  const payload: Record<string, unknown> = {
    name: input.name,
    description: input.description,
    assignees: input.assigneeIds,
    priority: input.priority,
    due_date: input.dueDate,
    tags: input.tags,
    parent: input.parentTaskId
  }

  const task = await client.createTask(input.listId, payload)
  catalogue?.invalidateList(input.listId)
  catalogue?.invalidateSearch()
  return { task }
}
