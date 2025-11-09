import { z } from "zod"
import { UpdateTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { updateTask } from "./UpdateTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof UpdateTasksBulkInput>

type NormalisedUpdate = {
  taskId: string
  fields: {
    name?: string
    description?: string
    status?: string
    priority?: number
    dueDate?: string
    assigneeIds?: string[]
    tags?: string[]
  }
}

function normaliseUpdates(input: Input): NormalisedUpdate[] {
  const defaults = input.defaults ?? {}
  return input.tasks.map((task) => ({
    taskId: task.taskId,
    fields: {
      name: task.name ?? defaults.name,
      description: task.description ?? defaults.description,
      status: task.status ?? defaults.status,
      priority: task.priority ?? defaults.priority,
      dueDate: task.dueDate ?? defaults.dueDate,
      assigneeIds: task.assigneeIds ?? defaults.assigneeIds,
      tags: task.tags ?? defaults.tags
    }
  }))
}

export async function updateTasksBulk(
  input: Input,
  client: ClickUpClient,
  _config: ApplicationConfig,
  catalogue?: TaskCatalogue
) {
  const updates = normaliseUpdates(input)
  const outcomes = await runBulk(updates, async (update) => {
    const payloadBase = {
      taskId: update.taskId,
      preview: undefined as Record<string, unknown> | undefined,
      updatedFields: undefined as string[] | undefined
    }
    const resultInput = {
      taskId: update.taskId,
      name: update.fields.name,
      description: update.fields.description,
      status: update.fields.status,
      priority: update.fields.priority,
      dueDate: update.fields.dueDate,
      assigneeIds: update.fields.assigneeIds,
      tags: update.fields.tags,
      dryRun: input.dryRun ?? false,
      confirm: "yes" as const
    }

    try {
      const result = await updateTask(resultInput, client, catalogue)
      if (input.dryRun) {
        return {
          success: true as const,
          payload: {
            ...payloadBase,
            preview: result.preview
          }
        }
      }

      return {
        success: true as const,
        payload: {
          ...payloadBase,
          updatedFields: Object.keys(update.fields).filter(
            (key) => update.fields[key as keyof typeof update.fields] !== undefined
          )
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
