import { z } from "zod"
import { SafetyInput } from "./safety.js"
import { HierarchyPathSegment } from "./hierarchy.js"

const HierarchyPath = z
  .array(HierarchyPathSegment)
  .min(1)
  .describe("Ordered workspace/space/folder/list segments to resolve.")

const RequiredId = z.coerce
  .string()
  .min(1)
  .describe("ClickUp identifier required for this call.")

const StatusDefinition = z
  .object({
    status: z
      .string()
      .min(1)
      .describe("Internal status key; supply when known.")
      .optional(),
    name: z
      .string()
      .min(1)
      .describe("Status display name.")
      .optional(),
    type: z.string().describe("Status type e.g. open/closed.").optional(),
    color: z.string().describe("Hex colour code for the status.").optional(),
    orderindex: z
      .number()
      .describe("Ordering index; lower numbers appear first.")
      .optional(),
    description: z
      .string()
      .describe("Optional status description.")
      .optional()
  })
  .refine((value) => Boolean(value.status ?? value.name), {
    message: "Provide status or name"
  })

const StatusArray = z
  .array(StatusDefinition.describe("Status configuration entry."))
  .describe("Collection of statuses to set on the container.")
  .optional()

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
  spaceId: RequiredId.describe("Space ID to host the new folder.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the parent space.").optional(),
  name: z.string().min(1).describe("Folder name to create."),
  description: z
    .string()
    .describe("Folder description; omit to leave blank.")
    .optional(),
  statuses: StatusArray.describe("Status set to apply to the folder.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["spaceId"])
})

export const UpdateFolderInput = SafetyInput.extend({
  folderId: RequiredId.describe("Folder ID to update.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the folder.").optional(),
  name: z.string().min(1).describe("Updated folder name.").optional(),
  description: z
    .string()
    .describe("Updated folder description.")
    .optional(),
  statuses: StatusArray.describe("Complete status set to replace existing configuration.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId"])
  requireMutationFields(value, ctx)
})

export const DeleteFolderInput = SafetyInput.extend({
  folderId: RequiredId.describe("Folder ID to delete.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the folder.").optional()
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId"])
})

export const CreateListInput = SafetyInput.extend({
  spaceId: RequiredId.describe("Space ID hosting the list when folderId missing.").optional(),
  folderId: RequiredId.describe("Folder ID hosting the list.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the parent container.").optional(),
  name: z.string().min(1).describe("List name to create."),
  description: z
    .string()
    .describe("List description; omit to leave blank.")
    .optional(),
  statuses: StatusArray.describe("Status set to apply to the list.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["folderId", "spaceId"])
})

export const UpdateListInput = SafetyInput.extend({
  listId: RequiredId.describe("List ID to update.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the list.").optional(),
  name: z.string().min(1).describe("Updated list name.").optional(),
  description: z
    .string()
    .describe("Updated list description.")
    .optional(),
  statuses: StatusArray.describe("Complete status set to replace existing configuration.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
  requireMutationFields(value, ctx)
})

export const DeleteListInput = SafetyInput.extend({
  listId: RequiredId.describe("List ID to delete.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the list.").optional()
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
})

export const CreateListViewInput = SafetyInput.extend({
  listId: RequiredId.describe("List ID that will host the view.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the list.").optional(),
  name: z.string().min(1).describe("View name to create."),
  description: z
    .string()
    .describe("View description shown to users.")
    .optional(),
  viewType: z
    .string()
    .min(1)
    .describe("ClickUp view type identifier; omit for default.")
    .optional(),
  statuses: StatusArray.describe("Status filters to attach to the view.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["listId"])
})

export const CreateSpaceViewInput = SafetyInput.extend({
  spaceId: RequiredId.describe("Space ID that will host the view.").optional(),
  path: HierarchyPath.describe("Hierarchy path resolving to the space.").optional(),
  name: z.string().min(1).describe("View name to create."),
  description: z
    .string()
    .describe("View description shown to users.")
    .optional(),
  viewType: z
    .string()
    .min(1)
    .describe("ClickUp view type identifier; omit for default.")
    .optional(),
  statuses: StatusArray.describe("Status filters to attach to the view.")
}).superRefine((value, ctx) => {
  requireContainer(value, ctx, ["spaceId"])
})

export const UpdateViewInput = SafetyInput.extend({
  viewId: RequiredId.describe("View ID to update."),
  name: z.string().min(1).describe("Updated view name.").optional(),
  description: z
    .string()
    .describe("Updated view description.")
    .optional(),
  viewType: z
    .string()
    .min(1)
    .describe("Updated view type identifier.")
    .optional(),
  statuses: StatusArray.describe("Status filters to replace existing configuration.")
}).superRefine((value, ctx) => {
  requireMutationFields(value, ctx, [
    { key: "viewType", present: Boolean(value.viewType) }
  ])
})

export const DeleteViewInput = SafetyInput.extend({
  viewId: RequiredId.describe("View ID to delete.")
})

export type StatusInput = z.infer<typeof StatusDefinition>
export type HierarchyPathInput = z.infer<typeof HierarchyPath>
