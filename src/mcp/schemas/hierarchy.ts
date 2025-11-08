import { z } from "zod"

export const ListSpacesInput = z.object({
  workspaceId: z.string()
})

export const ListFoldersInput = z.object({
  spaceId: z.string()
})

export const ListListsInput = z.object({
  folderId: z.string().optional(),
  spaceId: z.string().optional()
})

export const ListTagsForSpaceInput = z.object({
  spaceId: z.string()
})

export const ListMembersInput = z.object({
  teamId: z.string().optional()
})

export const ResolveMembersInput = z.object({
  identifiers: z.array(z.string())
})

export const ResolvePathToIdsInput = z.object({
  path: z.array(z.object({
    type: z.enum(["workspace", "space", "folder", "list"]),
    name: z.string()
  }))
})

export const GetWorkspaceOverviewInput = z.object({
  workspaceId: z.string()
})
