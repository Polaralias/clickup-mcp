import { z } from "zod"
import { DeleteListInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../services/HierarchyDirectory.js"
import { resolveIdsFromPath, resolveListParents } from "./structureShared.js"

type Input = z.infer<typeof DeleteListInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
  listId?: string
  nextSteps: string[]
}

export async function deleteList(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory
): Promise<Result> {
  const resolution = await resolveIdsFromPath(input.path, client, directory)
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

  const parentContext =
    resolution?.folderId || resolution?.spaceId
      ? { folderId: resolution?.folderId, spaceId: resolution?.spaceId }
      : await resolveListParents(listId, client)

  await client.deleteList(listId)
  if (parentContext?.folderId) {
    directory.invalidateListsForFolder(parentContext.folderId)
  } else if (parentContext?.spaceId) {
    directory.invalidateListsForSpace(parentContext.spaceId)
  } else {
    directory.invalidateAllLists()
  }
  return {
    status: "deleted",
    listId,
    nextSteps
  }
}
