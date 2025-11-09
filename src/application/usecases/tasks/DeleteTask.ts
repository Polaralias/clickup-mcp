import { z } from "zod"
import { DeleteTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type Input = z.infer<typeof DeleteTaskInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function deleteTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId } }
  }

  await client.deleteTask(input.taskId)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()
  return { status: "deleted" }
}
