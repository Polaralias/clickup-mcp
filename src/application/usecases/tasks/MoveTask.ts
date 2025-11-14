import { z } from "zod"
import { MoveTaskInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { TaskCatalogue } from "../../services/TaskCatalogue.js"

type Input = z.infer<typeof MoveTaskInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
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

export async function moveTask(
  input: Input,
  client: ClickUpClient,
  catalogue?: TaskCatalogue
): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, targetListId: input.listId } }
  }

  await client.moveTask(input.taskId, input.listId)
  const verificationResponse = await client.getTask(input.taskId)
  const payload = verificationResponse?.task ?? verificationResponse ?? {}
  const actualListId = extractListId(payload)
  const expectedListId = input.listId

  if (!actualListId || actualListId !== expectedListId) {
    throw new Error(
      `Post-move verification failed: task ${input.taskId} expected in list ${expectedListId} but found ${actualListId ?? "unknown"}`
    )
  }
  catalogue?.invalidateTask(input.taskId)
  catalogue?.invalidateList(input.listId)
  catalogue?.invalidateSearch()
  return { status: "moved" }
}
