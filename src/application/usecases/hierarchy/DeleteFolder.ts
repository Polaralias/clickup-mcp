import { z } from "zod"
import { DeleteFolderInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../services/HierarchyDirectory.js"
import { resolveIdsFromPath } from "./structureShared.js"

type Input = z.infer<typeof DeleteFolderInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
  folderId?: string
  nextSteps: string[]
}

export async function deleteFolder(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory
): Promise<Result> {
  const resolution = await resolveIdsFromPath(input.path, client, directory)
  const folderId = input.folderId ?? resolution?.folderId
  if (!folderId) {
    throw new Error("Provide folderId or include a folder segment in path")
  }

  const nextSteps = [
    "Run clickup_list_folders to confirm the folder is removed.",
    "Use clickup_create_folder if you need to recreate a container."
  ]

  if (input.dryRun) {
    return {
      preview: { action: "delete", folderId },
      nextSteps
    }
  }

  await client.deleteFolder(folderId)
  if (resolution?.spaceId) {
    directory.invalidateFolders(resolution.spaceId)
    directory.invalidateListsForSpace(resolution.spaceId)
  }
  directory.invalidateListsForFolder(folderId)
  return {
    status: "deleted",
    folderId,
    nextSteps
  }
}
