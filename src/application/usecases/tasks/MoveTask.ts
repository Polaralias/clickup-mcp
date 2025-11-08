import { z } from "zod"
import { MoveTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof MoveTaskInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function moveTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, targetListId: input.listId } }
  }

  await client.moveTask(input.taskId, input.listId)
  return { status: "moved" }
}
