import { z } from "zod"
import { DeleteListInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { resolveIdsFromPath } from "./structureShared.js"

type Input = z.infer<typeof DeleteListInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
  listId?: string
  nextSteps: string[]
}

export async function deleteList(input: Input, client: ClickUpClient): Promise<Result> {
  const resolution = await resolveIdsFromPath(input.path, client)
  const listId = input.listId ?? resolution?.listId
  if (!listId) {
    throw new Error("Provide listId or include a list segment in path")
  }

  const nextSteps = [
    "Call clickup_list_lists to confirm the list was removed.",
    "Use clickup_create_list if you need a replacement list."
  ]

  if (input.dryRun) {
    return {
      preview: { action: "delete", listId },
      nextSteps
    }
  }

  await client.deleteList(listId)
  return {
    status: "deleted",
    listId,
    nextSteps
  }
}
