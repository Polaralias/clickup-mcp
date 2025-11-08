import { z } from "zod"
import { AddTagsInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof AddTagsInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function addTagsToTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, tags: input.tags } }
  }

  await client.addTags(input.taskId, input.tags)
  return { status: "tags_added" }
}
