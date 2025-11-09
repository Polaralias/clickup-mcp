import { z } from "zod"
import { MoveTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { moveTask } from "./MoveTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof MoveTasksBulkInput>

type NormalisedMove = {
  taskId: string
  listId: string
}

function normaliseMoves(input: Input): NormalisedMove[] {
  const defaults = input.defaults ?? {}
  return input.tasks.map((task) => ({
    taskId: task.taskId,
    listId: (task.listId ?? defaults.listId)!
  }))
}

export async function moveTasksBulk(
  input: Input,
  client: ClickUpClient,
  _config: ApplicationConfig,
  catalogue?: TaskCatalogue
) {
  const moves = normaliseMoves(input)
  const outcomes = await runBulk(moves, async (move) => {
    const payloadBase = {
      taskId: move.taskId,
      listId: move.listId,
      preview: undefined as Record<string, unknown> | undefined,
      status: undefined as string | undefined
    }
    const resultInput = {
      taskId: move.taskId,
      listId: move.listId,
      dryRun: input.dryRun ?? false,
      confirm: "yes" as const
    }

    try {
      const result = await moveTask(resultInput, client, catalogue)
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
