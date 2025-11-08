import { z } from "zod"
import { DeleteTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof DeleteTaskInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function deleteTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId } }
  }

  await client.deleteTask(input.taskId)
  return { status: "deleted" }
}
