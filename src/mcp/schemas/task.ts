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
