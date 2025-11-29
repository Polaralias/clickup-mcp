import { z } from "zod"
import { ClearTaskCustomFieldValueInput } from "../../../mcp/schemas/customFields.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import { resolveCustomFieldMetadata } from "./customFieldShared.js"

type Input = z.infer<typeof ClearTaskCustomFieldValueInput>

type Result = {
  preview?: Record<string, unknown>
  taskId: string
  fieldId: string
  fieldName?: string
  status?: string
}

export async function clearTaskCustomFieldValue(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const context = await resolveCustomFieldMetadata(input.taskId, input.fieldId, client)
  if (!context.field) {
    throw new Error("Custom field metadata could not be resolved for clearing.")
  }

  if (input.dryRun) {
    return {
      preview: {
        taskId: input.taskId,
        fieldId: input.fieldId,
        action: "clear"
      },
      taskId: input.taskId,
      fieldId: input.fieldId,
      fieldName: context.field.name
    }
  }

  await client.clearTaskCustomFieldValue(input.taskId, input.fieldId)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()

  return {
    taskId: input.taskId,
    fieldId: input.fieldId,
    fieldName: context.field.name,
    status: "cleared"
  }
}
