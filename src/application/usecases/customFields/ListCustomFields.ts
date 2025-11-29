import { z } from "zod"
import { ListCustomFieldsInput } from "../../../mcp/schemas/customFields.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../services/HierarchyDirectory.js"
import { resolveIdsFromPath } from "../hierarchy/structureShared.js"
import {
  CustomFieldMetadata,
  describeExpectedValue,
  extractListFields
} from "./customFieldShared.js"

type Input = z.infer<typeof ListCustomFieldsInput>

type Result = {
  listId: string
  fields: Array<CustomFieldMetadata & { expectedValue?: string }>
  total: number
}

export async function listCustomFields(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory
): Promise<Result> {
  const resolution = await resolveIdsFromPath(input.path, client, directory, {
    forceRefresh: input.forceRefresh
  })
  const listId = input.listId ?? resolution?.listId
  if (!listId) {
    throw new Error("Provide listId or a path resolving to a list")
  }

  const response = await client.getListCustomFields(listId)
  const fields = extractListFields(response).map((field) => ({
    ...field!,
    expectedValue: describeExpectedValue(field)
  }))

  return {
    listId,
    fields,
    total: fields.length
  }
}
