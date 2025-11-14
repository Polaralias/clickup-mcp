import { z } from "zod"
import { MoveTasksBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { summariseBulk, formatError } from "./bulkShared.js"
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

function normaliseListId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value
  }
  if (typeof value === "number") {
    return String(value)
  }
  return undefined
}

function extractListId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined
  }
  const candidate = payload as {
    list?: { id?: unknown } | null
    list_id?: unknown
    listId?: unknown
  }
  const listSource = candidate.list && typeof candidate.list === "object"
    ? (candidate.list as { id?: unknown })
    : undefined
  const fromList = normaliseListId(listSource?.id)
  return (
    fromList ??
    normaliseListId(candidate.list_id) ??
    normaliseListId(candidate.listId)
  )
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

  const verifiedResults = await Promise.all(
    results.map(async (result) => {
      if (!result.success) {
        return result
      }
      const verificationResponse = await client.getTask(result.taskId)
      const payload = verificationResponse?.task ?? verificationResponse ?? {}
      const actualListId = extractListId(payload)
      if (!actualListId || actualListId !== result.listId) {
        return {
          success: false as const,
          taskId: result.taskId,
          listId: result.listId,
          error: formatError(
            new Error(
              `Post-move verification failed: task ${result.taskId} expected in list ${result.listId} but found ${actualListId ?? "unknown"}`
            )
          )
        }
      }
      return result
    })
  )

  let invalidatedSearch = false
  verifiedResults.forEach((result) => {
    if (result.success) {
      catalogue?.invalidateTask(result.taskId)
      catalogue?.invalidateList(result.listId)
      invalidatedSearch = true
    }
  })
  if (invalidatedSearch) {
    catalogue?.invalidateSearch()
  }

  const outcomes = verifiedResults.map((result, index) => ({
    index,
    status: result.success ? ("success" as const) : ("failed" as const),
    payload: result.success
      ? { taskId: result.taskId, listId: result.listId, status: "moved" as const }
      : { taskId: result.taskId, listId: result.listId },
    error: result.success ? undefined : result.error
  }))

  return summariseBulk(outcomes, {
    dryRun: input.dryRun ?? false,
    concurrency: CONCURRENCY_LIMIT,
    teamId: input.teamId
  })
}
