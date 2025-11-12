import { z } from "zod"
import { MoveTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { summariseBulk } from "./bulkShared.js"
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
  if (input.dryRun) {
    const previewOutcomes = moves.map((move, index) => ({
      index,
      status: "success" as const,
      payload: {
        taskId: move.taskId,
        listId: move.listId,
        preview: { taskId: move.taskId, targetListId: move.listId }
      }
    }))
    return summariseBulk(previewOutcomes, {
      dryRun: true,
      concurrency: CONCURRENCY_LIMIT,
      teamId: input.teamId
    })
  }

  const results = await client.moveTasksBulk(moves, { concurrency: CONCURRENCY_LIMIT })

  let invalidatedSearch = false
  results.forEach((result) => {
    if (result.success) {
      catalogue?.invalidateTask(result.taskId)
      catalogue?.invalidateList(result.listId)
      invalidatedSearch = true
    }
  })
  if (invalidatedSearch) {
    catalogue?.invalidateSearch()
  }

  const outcomes = results.map((result, index) => ({
    index,
    status: result.success ? ("success" as const) : ("failed" as const),
    payload: {
      taskId: result.taskId,
      listId: result.listId,
      status: result.success ? "moved" : undefined
    },
    error: result.success ? undefined : result.error
  }))

  return summariseBulk(outcomes, {
    dryRun: input.dryRun ?? false,
    concurrency: CONCURRENCY_LIMIT,
    teamId: input.teamId
  })
}
