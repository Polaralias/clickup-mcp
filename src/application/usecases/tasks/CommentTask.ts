import { z } from "zod"
import { CommentTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof CommentTaskInput>

type Result = {
  preview?: Record<string, unknown>
  comment?: Record<string, unknown>
}

export async function commentTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, characters: input.comment.length } }
  }

  const payload = { comment_text: input.comment }
  const comment = await client.commentTask(input.taskId, payload)
  return { comment }
}
