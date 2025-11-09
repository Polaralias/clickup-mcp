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

export async function getWorkspaceOverview(
  input: Input,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<Result> {
  const ensureOptions: HierarchyEnsureOptions = {
    forceRefresh: options.forceRefresh ?? input.forceRefresh
  }
  const { cache } = await directory.ensureWorkspaces(
    () => client.listWorkspaces(),
    ensureOptions
  )
  const workspace = await client.getWorkspaceOverview(input.workspaceId)
  return { workspace, cache: { workspaces: cache } }
}
