import { z } from "zod"
import { AddTagsInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type Input = z.infer<typeof AddTagsInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function addTagsToTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, tags: input.tags } }
  }

  await client.addTags(input.taskId, input.tags)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()
  return { status: "tags_added" }
}
