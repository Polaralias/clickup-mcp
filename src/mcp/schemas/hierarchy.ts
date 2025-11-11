import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string()
const RequiredId = z.coerce.string().min(1)

export const ListWorkspacesInput = z.object({
  forceRefresh: z.boolean().optional()
})

export const ListSpacesInput = z.object({
  workspaceId: Id,
  forceRefresh: z.boolean().optional()
})

export const ListFoldersInput = z.object({
  spaceId: Id,
  forceRefresh: z.boolean().optional()
})

export const ListListsInput = z.object({
  folderId: Id.optional(),
  spaceId: Id.optional(),
  forceRefresh: z.boolean().optional()
})

export const ListTagsForSpaceInput = z.object({
  spaceId: Id,
  forceRefresh: z.boolean().optional()
})

export const CreateSpaceTagInput = SafetyInput.extend({
  spaceId: RequiredId,
  name: z.string().min(1),
  foregroundColor: z.string().min(1).optional(),
  backgroundColor: z.string().min(1).optional()
})

export const UpdateSpaceTagInput = SafetyInput.extend({
  spaceId: RequiredId,
  currentName: z.string().min(1),
  name: z.string().min(1).optional(),
  foregroundColor: z.string().min(1).optional(),
  backgroundColor: z.string().min(1).optional()
}).superRefine((value, ctx) => {
  if (!value.name && !value.foregroundColor && !value.backgroundColor) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide a new name or updated colours",
      path: ["name"]
    })
  }
})

export const DeleteSpaceTagInput = SafetyInput.extend({
  spaceId: RequiredId,
  name: z.string().min(1)
})

export const ListMembersInput = z.object({
  teamId: Id.optional()
})

export const ResolveMembersInput = z.object({
  identifiers: z.array(z.string().min(1)),
  teamId: RequiredId.optional(),
  limit: z.number().int().min(1).max(10).optional(),
  refresh: z.boolean().optional()
})

export const HierarchyPathSegment = z.object({
  type: z.enum(["workspace", "space", "folder", "list"]),
  name: z.string()
})

export const ResolvePathToIdsInput = z.object({
  path: z.array(HierarchyPathSegment),
  forceRefresh: z.boolean().optional()
})

export const GetWorkspaceOverviewInput = z.object({
  workspaceId: Id,
  forceRefresh: z.boolean().optional()
})

const WorkspaceSelector = z
  .object({
    id: RequiredId.optional(),
    name: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.id || value.name), {
    message: "Provide id or name"
  })

export const GetWorkspaceHierarchyInput = z.object({
  workspaceIds: z.array(RequiredId).optional(),
  workspaceNames: z.array(z.string().min(1)).optional(),
  workspaces: z.array(WorkspaceSelector).optional(),
  maxDepth: z.number().int().min(0).max(3).optional(),
  maxWorkspaces: z.number().int().min(1).optional(),
  maxSpacesPerWorkspace: z.number().int().min(1).optional(),
  maxFoldersPerSpace: z.number().int().min(1).optional(),
  maxListsPerSpace: z.number().int().min(1).optional(),
  maxListsPerFolder: z.number().int().min(1).optional(),
  concurrency: z.number().int().min(1).optional(),
  forceRefresh: z.boolean().optional()
})
