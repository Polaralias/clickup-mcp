import { z } from "zod"
import { SafetyInput } from "./safety.js"
import { HierarchyPathSegment } from "./hierarchy.js"

const HierarchyPath = z.array(HierarchyPathSegment).min(1)

const RequiredId = z.coerce.string().min(1)

const StatusDefinition = z
  .object({
    status: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    type: z.string().optional(),
    color: z.string().optional(),
    orderindex: z.number().optional(),
    description: z.string().optional()
  })
  .refine((value) => Boolean(value.status ?? value.name), {
    message: "Provide status or name"
  })

const StatusArray = z.array(StatusDefinition).optional()

function requireContainer<T extends { path?: z.infer<typeof HierarchyPath>; [key: string]: unknown }>(
  value: T,
  ctx: z.RefinementCtx,
  keys: string[]
) {
  const hasDirect = keys.some((key) => Boolean((value as Record<string, unknown>)[key]))
  if (hasDirect) {
    return
  }
  if (value.path && value.path.length > 0) {
    return
  }
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Provide ${keys.join(" or ")} or include a matching segment in path`,
    path: [keys[0]]
  })
}

function requireMutationFields<T extends { name?: string; description?: string; statuses?: unknown[] }>(
  value: T,
  ctx: z.RefinementCtx,
  additional?: Array<{ key: string; present: boolean }>
) {
  const hasField = Boolean(value.name ?? value.description ?? value.statuses?.length)
  const additionalPresent = additional?.some((entry) => entry.present)
  if (!hasField && !additionalPresent) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one field to update",
      path: ["name"]
    })
  }
}

export const CreateFolderInput = SafetyInput.extend({
  spaceId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["spaceId"])
})

export const UpdateFolderInput = SafetyInput.extend({
  folderId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId"])
  requireMutationFields(value, ctx)
})

export const DeleteFolderInput = SafetyInput.extend({
  folderId: RequiredId.optional(),
  path: HierarchyPath.optional()
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId"])
})

export const CreateListInput = SafetyInput.extend({
  spaceId: RequiredId.optional(),
  folderId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId", "spaceId"])
})

export const UpdateListInput = SafetyInput.extend({
  listId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
  requireMutationFields(value, ctx)
})

export const DeleteListInput = SafetyInput.extend({
  listId: RequiredId.optional(),
  path: HierarchyPath.optional()
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
})

export const CreateListViewInput = SafetyInput.extend({
  listId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  viewType: z.string().min(1).optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
})

export const CreateSpaceViewInput = SafetyInput.extend({
  spaceId: RequiredId.optional(),
  path: HierarchyPath.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  viewType: z.string().min(1).optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["spaceId"])
})

export const UpdateViewInput = SafetyInput.extend({
  viewId: RequiredId,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  viewType: z.string().min(1).optional(),
  statuses: StatusArray
}).superRefine((value, ctx) => {
  requireMutationFields(value, ctx, [
    { key: "viewType", present: Boolean(value.viewType) }
  ])
})

export const DeleteViewInput = SafetyInput.extend({
  viewId: RequiredId
})

export type StatusInput = z.infer<typeof StatusDefinition>
export type HierarchyPathInput = z.infer<typeof HierarchyPath>
