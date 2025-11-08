import { z } from "zod"
import { ResolvePathToIdsInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ResolvePathToIdsInput>

type Result = {
  workspaceId?: string
  spaceId?: string
  folderId?: string
  listId?: string
}

function findByName(items: any[], name: string) {
  const lower = name.toLowerCase()
  return items.find((item) => {
    const itemName = item.name ?? item.title ?? item.space_name
    return typeof itemName === "string" && itemName.toLowerCase() === lower
  })
}

export async function resolvePathToIds(input: Input, client: ClickUpClient): Promise<Result> {
  const result: Result = {}

  for (const segment of input.path) {
    if (segment.type === "workspace") {
      const workspacesResponse = await client.listWorkspaces()
      const workspaces = Array.isArray(workspacesResponse?.teams) ? workspacesResponse.teams : workspacesResponse
      const match = findByName(workspaces ?? [], segment.name)
      if (!match) throw new Error(`Workspace not found: ${segment.name}`)
      result.workspaceId = match.id ?? match.team_id
    }

    if (segment.type === "space") {
      if (!result.workspaceId) {
        throw new Error("Resolve workspace before space")
      }
      const spacesResponse = await client.listSpaces(result.workspaceId)
      const spaces = Array.isArray(spacesResponse?.spaces) ? spacesResponse.spaces : spacesResponse
      const match = findByName(spaces ?? [], segment.name)
      if (!match) throw new Error(`Space not found: ${segment.name}`)
      result.spaceId = match.id ?? match.space_id
    }

    if (segment.type === "folder") {
      if (!result.spaceId) {
        throw new Error("Resolve space before folder")
      }
      const foldersResponse = await client.listFolders(result.spaceId)
      const folders = Array.isArray(foldersResponse?.folders) ? foldersResponse.folders : foldersResponse
      const match = findByName(folders ?? [], segment.name)
      if (!match) throw new Error(`Folder not found: ${segment.name}`)
      result.folderId = match.id ?? match.folder_id
    }

    if (segment.type === "list") {
      if (!result.spaceId && !result.folderId) {
        throw new Error("Resolve space or folder before list")
      }
      const listsResponse = await client.listLists(result.spaceId ?? "", result.folderId)
      const lists = Array.isArray(listsResponse?.lists) ? listsResponse.lists : listsResponse
      const match = findByName(lists ?? [], segment.name)
      if (!match) throw new Error(`List not found: ${segment.name}`)
      result.listId = match.id ?? match.list_id
    }
  }

  return result
}
