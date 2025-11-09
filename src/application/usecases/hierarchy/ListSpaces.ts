import { z } from "zod"
import { ListSpacesInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions,
  HierarchyCacheMetadata
} from "../../services/HierarchyDirectory.js"

type Input = z.infer<typeof ListSpacesInput>

type Result = {
  spaces: unknown[]
  cache: HierarchyCacheMetadata
}

export async function listSpaces(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<Result> {
  const { items, cache } = await directory.ensureSpaces(
    input.workspaceId,
    () => client.listSpaces(input.workspaceId),
    { forceRefresh: options.forceRefresh ?? input.forceRefresh }
  )
  return { spaces: items, cache }
}
