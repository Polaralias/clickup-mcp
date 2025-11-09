import { z } from "zod"
import { SafetyInput } from "./safety.js"

const TagArray = z.array(z.string()).default([])
const numericIdPattern = /^[0-9]+$/

const TaskContextTask = z
  .object({
    id: z.string(),
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
    listId: z.string().optional(),
    listName: z.string().optional(),
    listUrl: z.string().optional(),
    list: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        url: z.string().optional()
      })
      .partial()
      .optional(),
    url: z.string().optional()
  })
  .passthrough()

const TaskLookupReference = z.object({
  taskId: z.string().optional(),
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
  listId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  tags: TagArray.optional()
})

export const UpdateTaskInput = SafetyInput.extend({
  taskId: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  tags: TagArray.optional()
})

export const DeleteTaskInput = SafetyInput.extend({
  taskId: z.string()
})

export const MoveTaskInput = SafetyInput.extend({
  taskId: z.string(),
  listId: z.string()
})

export const DuplicateTaskInput = SafetyInput.extend({
  taskId: z.string(),
  listId: z.string().optional(),
  includeChecklists: z.boolean().optional(),
  includeAssignees: z.boolean().optional()
})

export const CommentTaskInput = SafetyInput.pick({ dryRun: true, confirm: true }).extend({
  taskId: z.string(),
  comment: z.string().min(1)
})

export const AttachFileInput = SafetyInput.extend({
  taskId: z.string(),
  filename: z.string(),
  dataUri: z.string()
})

export const AddTagsInput = SafetyInput.extend({
  taskId: z.string(),
  tags: TagArray
})

export const RemoveTagsInput = SafetyInput.extend({
  taskId: z.string(),
  tags: TagArray
})

const BulkCreateDefaults = z
  .object({
    listId: z.string().optional(),
    description: z.string().optional(),
    assigneeIds: z.array(z.string()).optional(),
    priority: z.number().int().min(0).max(4).optional(),
    dueDate: z.string().optional(),
    tags: TagArray.optional()
  })
  .partial()

const BulkCreateTask = z.object({
  listId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
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
  assigneeIds: z.array(z.string()).optional(),
  tags: TagArray.optional()
})

const BulkUpdateTask = UpdateFields.extend({
  taskId: z.string()
})

const BulkMoveDefaults = z
  .object({
    listId: z.string().optional()
  })
  .partial()

const BulkMoveTask = z.object({
  taskId: z.string(),
  listId: z.string().optional()
})

const BulkTagDefaults = z
  .object({
    tags: TagArray
  })
  .partial()

const BulkTagTask = z.object({
  taskId: z.string(),
  tags: TagArray.optional()
})

export const CreateTasksBulkInput = SafetyInput.extend({
  teamId: z.string().optional(),
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
  teamId: z.string().optional(),
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
  teamId: z.string().optional(),
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
  teamId: z.string().optional(),
  tasks: z.array(z.object({ taskId: z.string() })).min(1)
})

export const AddTagsBulkInput = SafetyInput.extend({
  teamId: z.string().optional(),
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
  listIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
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
  listId: z.string().optional(),
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
