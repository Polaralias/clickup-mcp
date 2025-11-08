import { z } from "zod"
import { DuplicateTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof DuplicateTaskInput>

type Result = {
  preview?: Record<string, unknown>
  task?: Record<string, unknown>
}

export async function duplicateTask(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return {
      preview: {
        taskId: input.taskId,
        targetListId: input.listId ?? null,
        includeChecklists: Boolean(input.includeChecklists),
        includeAssignees: Boolean(input.includeAssignees)
      }
    }
  }

  const payload: Record<string, unknown> = {
    include_checklists: input.includeChecklists,
    include_assignees: input.includeAssignees,
    list: input.listId
  }

  const task = await client.duplicateTask(input.taskId, payload)
  return { task }
}
