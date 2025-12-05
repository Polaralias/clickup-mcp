import type { ApplicationConfig } from "../config/applicationConfig.js"
import type { ClickUpClient } from "../../infrastructure/clickup/ClickUpClient.js"

function normaliseId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim()
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function collectIds(input: Record<string, unknown>, keys: string[]): Set<string> {
  const results = new Set<string>()
  for (const key of keys) {
    const value = input[key]
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const id = normaliseId(entry)
        if (id) results.add(id)
      })
      continue
    }
    const id = normaliseId(value)
    if (id) {
      results.add(id)
    }
  }
  return results
}

async function resolveTaskContext(taskId: unknown, client: ClickUpClient) {
  const listIds = new Set<string>()
  const spaceIds = new Set<string>()

  const id = normaliseId(taskId)
  if (!id) return { listIds, spaceIds }

  const response = await client.getTask(id)
  const listId = normaliseId(response?.task?.list?.id ?? response?.list?.id)
  const spaceId = normaliseId(response?.task?.space?.id ?? response?.task?.team_id ?? response?.space?.id)

  if (listId) listIds.add(listId)
  if (spaceId) spaceIds.add(spaceId)

  return { listIds, spaceIds }
}

export async function ensureWriteAllowed(
  input: Record<string, unknown>,
  client: ClickUpClient,
  config: ApplicationConfig
) {
  const access = config.writeAccess
  if (access.mode === "read_write") {
    return
  }

  if (access.mode === "read_only") {
    throw new Error("Write operations are disabled in read-only mode.")
  }

  const spaceIds = collectIds(input, ["spaceId", "workspaceId", "teamId", "spaceIds", "workspaceIds"]) // teamId fallback
  const listIds = collectIds(input, ["listId", "listIds"])

  if (!spaceIds.size && !listIds.size && input.taskId !== undefined) {
    const derived = await resolveTaskContext(input.taskId, client)
    derived.listIds.forEach((id) => listIds.add(id))
    derived.spaceIds.forEach((id) => spaceIds.add(id))
  }

  const hasAllowedSpace = [...spaceIds].some((id) => access.allowedSpaces.has(id))
  const hasAllowedList = [...listIds].some((id) => access.allowedLists.has(id))

  if (hasAllowedSpace || hasAllowedList) {
    return
  }

  const allowedSpaces = [...access.allowedSpaces]
  const allowedLists = [...access.allowedLists]

  if (!spaceIds.size && !listIds.size) {
    throw new Error(
      `Write operations are restricted to spaces (${allowedSpaces.join(", ")}) or lists (${allowedLists.join(", ")}). Include a spaceId or listId to proceed.`
    )
  }

  throw new Error(
    `Write operations are limited to spaces (${allowedSpaces.join(", ")}) or lists (${allowedLists.join(", ")}). Provided context was not permitted.`
  )
}
