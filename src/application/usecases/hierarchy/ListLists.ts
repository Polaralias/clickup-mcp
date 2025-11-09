import { z } from "zod"
import { ListListsInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions,
  HierarchyCacheMetadata
} from "../../services/HierarchyDirectory.js"

type Input = z.infer<typeof ListListsInput>

type Result = {
  lists: unknown[]
  cache: HierarchyCacheMetadata
}

export async function listLists(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<Result> {
  const spaceId = input.spaceId
  const folderId = input.folderId
  const { items, cache } = await directory.ensureLists(
    spaceId,
    folderId,
    () => client.listLists(spaceId ?? "", folderId),
    { forceRefresh: options.forceRefresh ?? input.forceRefresh }
  )
  return { lists: items, cache }
}
