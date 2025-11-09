import { z } from "zod"
import { ListFoldersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions,
  HierarchyCacheMetadata
} from "../../services/HierarchyDirectory.js"

type Input = z.infer<typeof ListFoldersInput>

type Result = {
  folders: unknown[]
  cache: HierarchyCacheMetadata
}

export async function listFolders(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<Result> {
  const { items, cache } = await directory.ensureFolders(
    input.spaceId,
    () => client.listFolders(input.spaceId),
    { forceRefresh: options.forceRefresh ?? input.forceRefresh }
  )
  return { folders: items, cache }
}
