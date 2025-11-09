import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions
} from "../../services/HierarchyDirectory.js"

export async function listWorkspaces(
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
) {
  const { items, cache } = await directory.ensureWorkspaces(
    () => client.listWorkspaces(),
    options
  )
  return { workspaces: items, cache }
}
