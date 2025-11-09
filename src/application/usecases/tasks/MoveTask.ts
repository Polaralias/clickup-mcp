import { z } from "zod"
import { MoveTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type Input = z.infer<typeof MoveTaskInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function moveTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, targetListId: input.listId } }
  }

  await client.moveTask(input.taskId, input.listId)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateList(input.listId)
  catalogue?.invalidateSearch()
  return { status: "moved" }
}
