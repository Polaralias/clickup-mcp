import { z } from "zod"
import { RemoveTagsInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof RemoveTagsInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function removeTagsFromTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, tags: input.tags } }
  }

  await client.removeTags(input.taskId, input.tags)
  return { status: "tags_removed" }
}
