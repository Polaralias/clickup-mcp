import { z } from "zod"
import { CreateTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { createTask } from "./CreateTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof CreateTasksBulkInput>

type NormalisedCreateTask = {
  listId: string
  name: string
  description?: string
  assigneeIds?: string[]
  priority?: number
  dueDate?: string
  tags?: string[]
}

function normaliseTasks(input: Input): NormalisedCreateTask[] {
  const defaults = input.defaults ?? {}
  return input.tasks.map((task) => ({
    listId: (task.listId ?? defaults.listId)!,
    name: task.name,
    description: task.description ?? defaults.description,
    assigneeIds: task.assigneeIds ?? defaults.assigneeIds,
    priority: task.priority ?? defaults.priority,
    dueDate: task.dueDate ?? defaults.dueDate,
    tags: task.tags ?? defaults.tags
  }))
}

export async function createTasksBulk(
  input: Input,
  client: ClickUpClient,
  _config: ApplicationConfig,
  catalogue?: TaskCatalogue
) {
  const tasks = normaliseTasks(input)
  const outcomes = await runBulk(tasks, async (task) => {
    const payloadBase = {
      listId: task.listId,
      name: task.name,
      taskId: undefined as string | undefined,
      preview: undefined as Record<string, unknown> | undefined
    }
    const resultInput = {
      listId: task.listId,
      name: task.name,
      description: task.description,
      assigneeIds: task.assigneeIds,
      priority: task.priority,
      dueDate: task.dueDate,
      tags: task.tags,
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
