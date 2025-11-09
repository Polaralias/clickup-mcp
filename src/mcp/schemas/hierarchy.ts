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

const WorkspaceSelector = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.id || value.name), {
    message: "Provide id or name"
  })

export const GetWorkspaceHierarchyInput = z.object({
  workspaceIds: z.array(z.string().min(1)).optional(),
  workspaceNames: z.array(z.string().min(1)).optional(),
  workspaces: z.array(WorkspaceSelector).optional(),
  maxDepth: z.number().int().min(0).max(3).optional(),
  maxWorkspaces: z.number().int().min(1).optional(),
  maxSpacesPerWorkspace: z.number().int().min(1).optional(),
  maxFoldersPerSpace: z.number().int().min(1).optional(),
  maxListsPerSpace: z.number().int().min(1).optional(),
  maxListsPerFolder: z.number().int().min(1).optional(),
  concurrency: z.number().int().min(1).optional()
})
