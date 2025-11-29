import { z } from "zod"
import { SetTaskCustomFieldValueInput } from "../../../mcp/schemas/customFields.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"
import {
  describeExpectedValue,
  resolveCustomFieldMetadata,
  validateCustomFieldValue
} from "./customFieldShared.js"

type Input = z.infer<typeof SetTaskCustomFieldValueInput>

type Result = {
  preview?: Record<string, unknown>
  taskId: string
  fieldId: string
  value?: unknown
  fieldName?: string
  expectedValue?: string
  status?: string
}

export async function setTaskCustomFieldValue(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  const context = await resolveCustomFieldMetadata(input.taskId, input.fieldId, client)
  const expectedValue = describeExpectedValue(context.field)
  const normalisedValue = validateCustomFieldValue(context.field, input.value)

  if (input.dryRun) {
    return {
      preview: {
        taskId: input.taskId,
        fieldId: input.fieldId,
        value: normalisedValue,
        expectedValue
      },
      taskId: input.taskId,
      fieldId: input.fieldId,
      value: normalisedValue,
      fieldName: context.field?.name,
      expectedValue
    }
  }

  await client.setTaskCustomFieldValue(input.taskId, input.fieldId, normalisedValue)
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateSearch()

  return {
    taskId: input.taskId,
    fieldId: input.fieldId,
    value: normalisedValue,
    fieldName: context.field?.name,
    expectedValue,
    status: "updated"
  }
}
