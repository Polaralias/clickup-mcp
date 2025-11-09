import { z } from "zod"
import { DeleteTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { deleteTask } from "./DeleteTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof DeleteTasksBulkInput>

type Target = {
  taskId: string
}

export async function deleteTasksBulk(input: Input, client: ClickUpClient, _config: ApplicationConfig) {
  const targets: Target[] = input.tasks.map((task) => ({ taskId: task.taskId }))
  const outcomes = await runBulk(targets, async (target) => {
    const payloadBase = {
      taskId: target.taskId,
      preview: undefined as Record<string, unknown> | undefined,
      status: undefined as string | undefined
    }
    const resultInput = {
      taskId: target.taskId,
      dryRun: input.dryRun ?? false,
      confirm: "yes" as const
    }

    try {
      const result = await deleteTask(resultInput, client)
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
          status: result.status,
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
