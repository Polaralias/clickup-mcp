import { z } from "zod"
import { GetWorkspaceOverviewInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions,
  HierarchyCacheMetadata
} from "../../services/HierarchyDirectory.js"

type Input = z.infer<typeof GetWorkspaceOverviewInput>

type Result = {
  workspace: Record<string, unknown>
  cache?: {
    workspaces: HierarchyCacheMetadata
  }
}

function ensureArray(candidate: unknown, property?: string): Record<string, unknown>[] {
  if (property && candidate && typeof candidate === "object") {
    const nested = (candidate as Record<string, unknown>)[property]
    if (Array.isArray(nested)) {
      return nested as Record<string, unknown>[]
    }
  }
  if (Array.isArray(candidate)) {
    return candidate as Record<string, unknown>[]
  }
  return []
}

export async function getWorkspaceOverview(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<Result> {
  const ensureOptions: HierarchyEnsureOptions = {
    forceRefresh: options.forceRefresh ?? input.forceRefresh
  }
  const { cache, items: workspaces } = await directory.ensureWorkspaces(
    () => client.listWorkspaces(),
    ensureOptions
  )
  
  // Find the workspace by ID in the cached list
  const workspace = ensureArray(workspaces).find(
    (w) => (w.id ?? w.team_id) === input.workspaceId
  )
  
  if (!workspace) {
    throw new Error(`Workspace not found: ${input.workspaceId}`)
  }
  
  return { workspace, cache: { workspaces: cache } }
}
