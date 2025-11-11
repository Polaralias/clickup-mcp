import { z } from "zod"
import { SafetyInput } from "./safety.js"

const Id = z.coerce.string()
const IdArray = z.array(Id)

const TagArray = z.array(z.string()).default([])
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

const TaskLookupReference = z.object({
  taskId: Id.optional(),
  taskName: z.string().optional(),
  context: z
    .object({
      tasks: z.array(TaskContextTask).min(1)
    })
    .optional()
})

export const TaskLookupContextInput = z.object({
  tasks: z.array(TaskContextTask).min(1)
})

export const CreateTaskInput = SafetyInput.extend({
  listId: Id,
  name: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: IdArray.optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  tags: TagArray.optional()
})

export const UpdateTaskInput = SafetyInput.extend({
  taskId: Id,
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  assigneeIds: IdArray.optional(),
  tags: TagArray.optional()
})

export const DeleteTaskInput = SafetyInput.extend({
  taskId: Id
})

export const MoveTaskInput = SafetyInput.extend({
  taskId: Id,
  listId: Id
})

export const DuplicateTaskInput = SafetyInput.extend({
  taskId: Id,
  listId: Id.optional(),
  includeChecklists: z.boolean().optional(),
  includeAssignees: z.boolean().optional()
})

export const CommentTaskInput = SafetyInput.pick({ dryRun: true, confirm: true }).extend({
  taskId: Id,
  comment: z.string().min(1)
})

export const AttachFileInput = SafetyInput.extend({
  taskId: Id,
  filename: z.string(),
  dataUri: z.string()
})

export const AddTagsInput = SafetyInput.extend({
  taskId: Id,
  tags: TagArray
})

export const RemoveTagsInput = SafetyInput.extend({
  taskId: Id,
  tags: TagArray
})

const BulkCreateDefaults = z
  .object({
    listId: Id.optional(),
    description: z.string().optional(),
    assigneeIds: IdArray.optional(),
    priority: z.number().int().min(0).max(4).optional(),
    dueDate: z.string().optional(),
    tags: TagArray.optional()
  })
  .partial()

const BulkCreateTask = z.object({
  listId: Id.optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: IdArray.optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  tags: TagArray.optional()
})

const UpdateFields = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  assigneeIds: IdArray.optional(),
  tags: TagArray.optional()
})

const BulkUpdateTask = UpdateFields.extend({
  taskId: Id
})

const BulkMoveDefaults = z
  .object({
    listId: Id.optional()
  })
  .partial()

const BulkMoveTask = z.object({
  taskId: Id,
  listId: Id.optional()
})

const BulkTagDefaults = z
  .object({
    tags: TagArray
  })
  .partial()

const BulkTagTask = z.object({
  taskId: Id,
  tags: TagArray.optional()
})

export const CreateTasksBulkInput = SafetyInput.extend({
  teamId: Id.optional(),
  defaults: BulkCreateDefaults.optional(),
  tasks: z.array(BulkCreateTask).min(1)
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
  teamId: Id.optional(),
  defaults: UpdateFields.optional(),
  tasks: z.array(BulkUpdateTask).min(1)
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
  teamId: Id.optional(),
  defaults: BulkMoveDefaults.optional(),
  tasks: z.array(BulkMoveTask).min(1)
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
  teamId: Id.optional(),
  tasks: z.array(z.object({ taskId: Id })).min(1)
})

export const AddTagsBulkInput = SafetyInput.extend({
  teamId: Id.optional(),
  defaults: BulkTagDefaults.optional(),
  tasks: z.array(BulkTagTask).min(1)
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
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(20),
  query: z.string().optional(),
  listIds: IdArray.optional(),
  tagIds: IdArray.optional(),
  status: z.string().optional()
})

export const FuzzySearchInput = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(10)
})

export const BulkFuzzySearchInput = z.object({
  queries: z.array(z.string().min(1)),
  limit: z.number().int().min(1).max(20).default(5)
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
  detailLimit: z.number().int().min(1).max(50).default(10)
}).superRefine((value, ctx) => ensureTaskResolvable(value, ctx))

export const ListTasksInListInput = TaskLookupReference.extend({
  listId: Id.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  page: z.number().int().min(0).default(0),
  includeClosed: z.boolean().default(false),
  includeSubtasks: z.boolean().default(false),
  assigneePreviewLimit: z.number().int().min(1).max(10).default(5)
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
  limit: z.number().int().min(1).max(50).default(10)
}).superRefine((value, ctx) => ensureTaskResolvable(value, ctx))

export type TaskLookupContext = z.infer<typeof TaskLookupContextInput>
