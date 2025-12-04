import { z } from "zod"
import { CreateSubtasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { createTask } from "./CreateTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof CreateSubtasksBulkInput>

type NormalisedCreateSubtask = {
  listId: string
  parentTaskId: string
  name: string
  description?: string
  assigneeIds?: string[]
  priority?: number
  dueDate?: string
  tags?: string[]
}

function normaliseSubtasks(input: Input): NormalisedCreateSubtask[] {
  const defaults = input.defaults ?? {}
  return input.subtasks.map((subtask) => ({
    listId: (subtask.listId ?? defaults.listId)!,
    parentTaskId: (subtask.parentTaskId ?? defaults.parentTaskId)!,
    name: subtask.name,
    description: subtask.description ?? defaults.description,
    assigneeIds: subtask.assigneeIds ?? defaults.assigneeIds,
    priority: subtask.priority ?? defaults.priority,
    dueDate: subtask.dueDate ?? defaults.dueDate,
    tags: subtask.tags ?? defaults.tags
  }))
}

export async function createSubtasksBulk(
  input: Input,
  client: ClickUpClient,
  _config: ApplicationConfig,
  catalogue?: TaskCatalogue
) {
  const subtasks = normaliseSubtasks(input)
  subtasks.forEach((subtask, index) => {
    if (!subtask.parentTaskId) {
      throw new Error(`Subtask at index ${index} is missing parentTaskId after defaults were applied`)
    }
    if (!subtask.listId) {
      throw new Error(`Subtask at index ${index} is missing listId after defaults were applied`)
    }
  })
  const outcomes = await runBulk(subtasks, async (subtask) => {
    const payloadBase = {
      listId: subtask.listId,
      parentTaskId: subtask.parentTaskId,
      name: subtask.name,
      taskId: undefined as string | undefined,
      preview: undefined as Record<string, unknown> | undefined
    }

    const resultInput = {
      listId: subtask.listId,
      name: subtask.name,
      parentTaskId: subtask.parentTaskId,
      description: subtask.description,
      assigneeIds: subtask.assigneeIds,
      priority: subtask.priority,
      dueDate: subtask.dueDate,
      tags: subtask.tags,
      dryRun: input.dryRun ?? false,
      confirm: "yes" as const
    }

    try {
      const result = await createTask(resultInput, client, catalogue)
      if (input.dryRun) {
        return {
          success: true as const,
          payload: {
            ...payloadBase,
            preview: result.preview
          }
        }
      }

      const taskId = (result.task as Record<string, unknown> | undefined)?.id as string | undefined

      return {
        success: true as const,
        payload: {
          ...payloadBase,
          taskId,
          preview: undefined
        }
      }
    } catch (error) {
      return {
        success: false as const,
        payload: {
          ...payloadBase
        },
        error: formatError(error)
      }
    }
  }, CONCURRENCY_LIMIT)

  return summariseBulk(outcomes, {
    dryRun: input.dryRun ?? false,
    concurrency: CONCURRENCY_LIMIT,
    teamId: input.teamId
  })
}

