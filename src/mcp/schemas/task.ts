import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string().describe("ClickUp identifier, usually a numeric string.")
const IdArray = z
  .array(Id.describe("Identifier string."))
  .describe("Collection of ClickUp identifiers.")

const TagArray = z
  .array(z.string().min(1).describe("Tag label exactly as stored in ClickUp."))
  .describe("List of tag names; defaults to empty when omitted.")
  .default([])
const numericIdPattern = /^[0-9]+$/

const TaskContextTask = z
  .object({
    id: Id,
    name: z.string().optional(),
    description: z.string().optional(),
    text_content: z.string().optional(),
    status: z
      .union([
        z.string(),
        z
          .object({ status: z.string().optional() })
          .passthrough()
      ])
      .optional(),
    updatedAt: z.number().optional(),
    date_updated: z.union([z.string(), z.number()]).optional(),
    listId: Id.optional(),
    listName: z.string().optional(),
    listUrl: z.string().optional(),
    list: z
      .object({
        id: Id.optional(),
        name: z.string().optional(),
        url: z.string().optional()
      })
      .partial()
      .optional(),
    url: z.string().optional()
  })
  .passthrough()
  .describe("Task summary payload returned from listing/search tools.")

const TaskLookupReference = z.object({
  taskId: Id.describe("Exact task ID when already known.").optional(),
  taskName: z
    .string()
    .describe("Human name or numeric string to resolve when taskId missing.")
    .optional(),
  context: z
    .object({
      tasks: z
        .array(TaskContextTask)
        .min(1)
        .describe("Previously listed tasks to disambiguate taskName.")
    })
    .describe("Resolution context supplied from prior listing calls.")
    .optional()
})

export const TaskLookupContextInput = z.object({
  tasks: z
    .array(TaskContextTask)
    .min(1)
    .describe("Task context entries to use for disambiguation.")
})

export const CreateTaskInput = SafetyInput.extend({
  listId: Id.describe("Destination list ID where the task will be created."),
  name: z.string().min(1).describe("Task title; supply at least one character."),
  description: z
    .string()
    .describe("Rich description body; omit to leave blank.")
    .optional(),
  assigneeIds: IdArray.describe("User IDs to assign immediately.").optional(),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Priority 0 (none) through 4 (urgent).")
    .optional(),
  dueDate: z
    .string()
    .describe("ISO 8601 due date; omit to leave unscheduled.")
    .optional(),
  tags: TagArray.describe("Tag names to attach at creation.").optional()
})

export const UpdateTaskInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to modify."),
  name: z.string().describe("New task title.").optional(),
  description: z
    .string()
    .describe("Replacement description body.")
    .optional(),
  status: z
    .string()
    .describe("Status name exactly as configured in ClickUp.")
    .optional(),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Priority 0-4; omit to keep current value.")
    .optional(),
  dueDate: z
    .string()
    .describe("ISO 8601 due timestamp; omit for no change.")
    .optional(),
  assigneeIds: IdArray.describe("Replace assignees with these member IDs.").optional(),
  tags: TagArray.describe("Complete tag set to apply; overrides existing tags.").optional()
})

export const DeleteTaskInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to delete after confirmation.")
})

export const MoveTaskInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to move."),
  listId: Id.describe("Destination list ID for the task.")
})

export const DuplicateTaskInput = SafetyInput.extend({
  taskId: Id.describe("Source task ID to copy."),
  listId: Id.describe("Override target list; defaults to source list.").optional(),
  includeChecklists: z
    .boolean()
    .describe("true to clone checklists from the source task.")
    .optional(),
  includeAssignees: z
    .boolean()
    .describe("true to copy current assignees.")
    .optional()
})

export const CommentTaskInput = SafetyInput.pick({ dryRun: true, confirm: true }).extend({
  taskId: Id.describe("Task ID to receive the comment."),
  comment: z
    .string()
    .min(1)
    .describe("Markdown comment content to post.")
})

export const AttachFileInput = SafetyInput.extend({
  taskId: Id.describe("Task ID that will receive the attachment."),
  filename: z.string().describe("Original filename including extension."),
  dataUri: z
    .string()
    .describe("Base64 data URI payload; must include mime prefix.")
})

export const AddTagsInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to tag."),
  tags: TagArray.describe("Tag names to append to the task.")
})

export const RemoveTagsInput = SafetyInput.extend({
  taskId: Id.describe("Task ID to untag."),
  tags: TagArray.describe("Tag names to remove from the task.")
})

const BulkCreateDefaults = z
  .object({
    listId: Id.describe("Fallback list ID for tasks missing listId.").optional(),
    description: z
      .string()
      .describe("Default description to use when a task omits one.")
      .optional(),
    assigneeIds: IdArray.describe("Default assignee set applied to omitted tasks.").optional(),
    priority: z
      .number()
      .int()
      .min(0)
      .max(4)
      .describe("Default priority 0-4 for tasks missing priority.")
      .optional(),
    dueDate: z
      .string()
      .describe("Default ISO due date for tasks without dueDate.")
      .optional(),
    tags: TagArray.describe("Default tag set merged into each task.").optional()
  })
  .partial()

const BulkCreateTask = z.object({
  listId: Id.describe("List ID for this task; overrides defaults.listId.").optional(),
  name: z.string().min(1).describe("Task title for this entry."),
  description: z
    .string()
    .describe("Task-specific description overriding defaults.")
    .optional(),
  assigneeIds: IdArray.describe("Assignees for this task; overrides defaults.").optional(),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Priority for this task; overrides defaults.")
    .optional(),
  dueDate: z
    .string()
    .describe("Due date for this task; overrides defaults.")
    .optional(),
  tags: TagArray.describe("Tags for this task; merged with defaults.").optional()
})

const UpdateFields = z.object({
  name: z.string().describe("Replacement title to set.").optional(),
  description: z
    .string()
    .describe("Replacement description body.")
    .optional(),
  status: z
    .string()
    .describe("Status name to assign.")
    .optional(),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Priority 0-4 to apply.")
    .optional(),
  dueDate: z
    .string()
    .describe("Due date timestamp to set.")
    .optional(),
  assigneeIds: IdArray.describe("Assignee IDs to replace the current set.").optional(),
  tags: TagArray.describe("Complete tag set to enforce.").optional()
})

const BulkUpdateTask = UpdateFields.extend({
  taskId: Id.describe("Task ID receiving these updates.")
})

const BulkMoveDefaults = z
  .object({
    listId: Id.describe("Fallback destination list ID.").optional()
  })
  .partial()

const BulkMoveTask = z.object({
  taskId: Id.describe("Task ID to relocate."),
  listId: Id.describe("Destination list ID; falls back to defaults.listId.").optional()
})

const BulkTagDefaults = z
  .object({
    tags: TagArray.describe("Tags to merge into each task when missing.")
  })
  .partial()

const BulkTagTask = z.object({
  taskId: Id.describe("Task ID to tag in bulk."),
  tags: TagArray.describe("Override tags for this task; defaults applied if absent.").optional()
})

export const CreateTasksBulkInput = SafetyInput.extend({
  teamId: Id.describe("Workspace/team scope for bulk creation.").optional(),
  defaults: BulkCreateDefaults.describe("Fallback values merged into each task.").optional(),
  tasks: z
    .array(BulkCreateTask)
    .min(1)
    .describe("Tasks to create; each entry must include a name and resolvable list.")
}).superRefine((value, ctx) => {
  value.tasks.forEach((task, index) => {
    if (task.listId || value.defaults?.listId) {
      return
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tasks", index, "listId"],
      message: "Provide listId per task or in defaults"
    })
  })
})

function hasUpdateFields(candidate?: z.infer<typeof UpdateFields>) {
  if (!candidate) {
    return false
  }
  return (
    candidate.name !== undefined ||
    candidate.description !== undefined ||
    candidate.status !== undefined ||
    candidate.priority !== undefined ||
    candidate.dueDate !== undefined ||
    candidate.assigneeIds !== undefined ||
    candidate.tags !== undefined
  )
}

export const UpdateTasksBulkInput = SafetyInput.extend({
  teamId: Id.describe("Workspace/team scope for bulk update.").optional(),
  defaults: UpdateFields.describe("Fields applied when tasks omit them.").optional(),
  tasks: z
    .array(BulkUpdateTask)
    .min(1)
    .describe("Task updates; each item needs taskId plus changes or defaults.")
}).superRefine((value, ctx) => {
  const defaultsHaveFields = hasUpdateFields(value.defaults)
  value.tasks.forEach((task, index) => {
    if (hasUpdateFields(task) || defaultsHaveFields) {
      return
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tasks", index],
      message: "Provide at least one field to update or set defaults"
    })
  })
})

export const MoveTasksBulkInput = SafetyInput.extend({
  teamId: Id.describe("Workspace/team scope for bulk moves.").optional(),
  defaults: BulkMoveDefaults.describe("Fallback destination when tasks omit listId.").optional(),
  tasks: z
    .array(BulkMoveTask)
    .min(1)
    .describe("Task moves; each entry must resolve to a destination list.")
}).superRefine((value, ctx) => {
  value.tasks.forEach((task, index) => {
    if (task.listId || value.defaults?.listId) {
      return
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tasks", index, "listId"],
      message: "Provide listId per task or in defaults"
    })
  })
})

export const DeleteTasksBulkInput = SafetyInput.extend({
  teamId: Id.describe("Workspace/team scope for bulk deletes.").optional(),
  tasks: z
    .array(
      z
        .object({
          taskId: Id.describe("Task ID to delete.")
        })
        .describe("Deletion descriptor for a single task.")
    )
    .min(1)
    .describe("Tasks to delete; confirm before execution.")
})

export const AddTagsBulkInput = SafetyInput.extend({
  teamId: Id.describe("Workspace/team scope for tag operations.").optional(),
  defaults: BulkTagDefaults.describe("Tags merged into each task when tags omitted.").optional(),
  tasks: z
    .array(BulkTagTask)
    .min(1)
    .describe("Tasks receiving tag additions; supply taskId each time.")
}).superRefine((value, ctx) => {
  value.tasks.forEach((task, index) => {
    const tags = task.tags ?? value.defaults?.tags
    if (tags && tags.length > 0) {
      return
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["tasks", index, "tags"],
      message: "Provide tags per task or in defaults"
    })
  })
})

export const SearchTasksInput = z.object({
  page: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Zero-based results page to fetch."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Results per page; capped at 100."),
  query: z
    .string()
    .describe("Full text query; omit to list all tasks with other filters.")
    .optional(),
  listIds: IdArray.describe("Restrict to these list IDs.").optional(),
  tagIds: IdArray.describe("Restrict to tasks tagged with these IDs.").optional(),
  status: z
    .string()
    .describe("Filter by exact status name.")
    .optional()
})

export const FuzzySearchInput = z.object({
  query: z.string().min(1).describe("Term to fuzzy match against task names."),
  limit: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe("Maximum matches to return; defaults to 10. No hard cap applied.")
})

export const BulkFuzzySearchInput = z.object({
  queries: z
    .array(z.string().min(1).describe("Term to fuzzy match."))
    .min(1)
    .describe("Queries to execute in a single batch."),
  limit: z
    .number()
    .int()
    .min(1)
    .default(5)
    .describe("Maximum results per query; defaults to 5. No hard cap applied.")
})

function ensureTaskResolvable(
  value: z.infer<typeof TaskLookupReference>,
  ctx: z.RefinementCtx,
  issuePath: (string | number)[] = ["taskName"]
) {
  if (value.taskId) {
    return
  }
  const name = value.taskName?.trim()
  if (name) {
    if (numericIdPattern.test(name)) {
      return
    }
    if (value.context?.tasks?.length) {
      return
    }
  }
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: issuePath,
    message: "Provide taskId or taskName with supporting context"
  })
}

export const GetTaskInput = TaskLookupReference.extend({
  detailLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum linked records to expand (comments, assignees, etc.).")
}).superRefine((value, ctx) => ensureTaskResolvable(value, ctx))

export const ListTasksInListInput = TaskLookupReference.extend({
  listId: Id.describe("Explicit list ID; overrides taskId/taskName resolution.").optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .default(20)
    .describe("Maximum tasks to return; larger requests paginate automatically."),
  page: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Zero-based page index."),
  includeClosed: z
    .boolean()
    .default(false)
    .describe("true to include closed tasks in the listing."),
  includeSubtasks: z
    .boolean()
    .default(false)
    .describe("true to include child tasks."),
  assigneePreviewLimit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Number of assignee previews to include per task.")
}).superRefine((value, ctx) => {
  if (value.listId) {
    return
  }
  if (value.taskId) {
    return
  }
  ensureTaskResolvable(value, ctx, ["taskName"])
})

export const GetTaskCommentsInput = TaskLookupReference.extend({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum comments to return; older comments truncated if exceeded.")
}).superRefine((value, ctx) => ensureTaskResolvable(value, ctx))

export type TaskLookupContext = z.infer<typeof TaskLookupContextInput>
