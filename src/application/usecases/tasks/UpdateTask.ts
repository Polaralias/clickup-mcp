import { z } from "zod"
import { UpdateTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import { buildPreservedDescription, extractExistingDescription } from "./descriptionPreservation.js"

type Input = z.infer<typeof UpdateTaskInput>

type Result = {
  preview?: Record<string, unknown>
  task?: Record<string, unknown>
}

export async function updateTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const payload: Record<string, unknown> = {}
  if (input.name !== undefined) payload.name = input.name
  if (input.status !== undefined) payload.status = input.status
  if (input.priority !== undefined) payload.priority = input.priority
  if (input.dueDate !== undefined) payload.due_date = input.dueDate
  if (input.assigneeIds !== undefined) payload.assignees = input.assigneeIds
  if (input.tags !== undefined) payload.tags = input.tags
  if (input.parentTaskId !== undefined) payload.parent = input.parentTaskId

  const wantsDescriptionUpdate = input.description !== undefined
  const shouldPreserveDescription =
    wantsDescriptionUpdate && typeof input.description === "string" && input.description.trim() !== ""

  if (wantsDescriptionUpdate) {
    if (shouldPreserveDescription && !input.dryRun) {
      const response = await client.getTask(input.taskId)
      const existing = extractExistingDescription(response?.task ?? response)
      payload.description = buildPreservedDescription(input.description, existing)
    } else {
      payload.description = input.description
    }
  }

  if (input.dryRun) {
    const preview: Record<string, unknown> = {
      taskId: input.taskId,
      fields: Object.keys(payload)
    }

    if (wantsDescriptionUpdate) {
      preview.description = shouldPreserveDescription
        ? {
            newDescription: input.description,
            preservesExistingDescription: true,
            note:
              "Existing description will be kept beneath the new content using the standard separator during execution."
          }
        : { newDescription: input.description, preservesExistingDescription: false }
    }

    return { preview }
  }

  const task = await client.updateTask(input.taskId, payload)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()
  return { task }
}
