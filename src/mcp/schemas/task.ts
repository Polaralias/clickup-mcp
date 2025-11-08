import { z } from "zod"
import { SafetyInput } from "./safety.js"

const TagArray = z.array(z.string()).default([])

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
