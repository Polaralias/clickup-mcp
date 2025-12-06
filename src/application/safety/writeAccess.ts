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

async function resolveListSpaces(listIds: Set<string>, client: ClickUpClient) {
  const spaceIds = new Set<string>()

  for (const listId of listIds) {
    try {
      const response = await client.getList(listId)
      const directSpace = normaliseId(
        (response as Record<string, unknown>)?.space_id ??
          (response as Record<string, unknown>)?.spaceId ??
          (response as Record<string, unknown>)?.team_id
      )
      const nestedSpace = normaliseId((response as Record<string, unknown>)?.space && (response as any).space?.id)
      const folderSpace = normaliseId((response as Record<string, unknown>)?.folder && (response as any).folder?.space_id)

      if (directSpace) spaceIds.add(directSpace)
      if (nestedSpace) spaceIds.add(nestedSpace)
      if (folderSpace) spaceIds.add(folderSpace)
    } catch {
      continue
    }
  }

  return { spaceIds }
}

async function resolveDocContext(docId: unknown, workspaceId: string | undefined, client: ClickUpClient) {
  const listIds = new Set<string>()
  const spaceIds = new Set<string>()

  const id = normaliseId(docId)
  if (!id || !workspaceId) return { listIds, spaceIds }

  try {
    const response = (await client.getDocument(workspaceId, id)) as Record<string, unknown>
    const spaceId = normaliseId(
      response.space_id ?? response.spaceId ?? response.team_id ?? response.workspace_id ?? (response.space as any)?.id
    )
    const listId = normaliseId(response.list_id ?? (response.list as any)?.id)

    if (spaceId) spaceIds.add(spaceId)
    if (listId) listIds.add(listId)
  } catch {
    return { listIds, spaceIds }
  }

  return { listIds, spaceIds }
}

export async function ensureWriteAllowed(
  input: Record<string, unknown>,
  client: ClickUpClient,
  config: ApplicationConfig
) {
  const access = config.writeAccess
  if (access.mode === "write") {
    return
  }

  if (access.mode === "read") {
    throw new Error("Write operations are disabled in read mode.")
  }

  const spaceIds = collectIds(input, ["spaceId", "workspaceId", "teamId", "spaceIds", "workspaceIds"]) // teamId fallback
  const listIds = collectIds(input, ["listId", "listIds"])

  if (!spaceIds.size && !listIds.size && input.taskId !== undefined) {
    const derived = await resolveTaskContext(input.taskId, client)
    derived.listIds.forEach((id) => listIds.add(id))
    derived.spaceIds.forEach((id) => spaceIds.add(id))
  }

  if (listIds.size && access.allowedSpaces.size) {
    const derived = await resolveListSpaces(listIds, client)
    derived.spaceIds.forEach((id) => spaceIds.add(id))
  }

  if (!spaceIds.size && !listIds.size && (input.docId !== undefined || input.documentId !== undefined)) {
    const docId = input.docId ?? input.documentId
    const derived = await resolveDocContext(docId, config.teamId, client)
    derived.listIds.forEach((id) => listIds.add(id))
    derived.spaceIds.forEach((id) => spaceIds.add(id))
  }

  const allowedIds = new Set<string>([...access.allowedSpaces, ...access.allowedLists])
  const hasAllowedSpace = [...spaceIds].some((id) => allowedIds.has(id))
  const hasAllowedList = [...listIds].some((id) => allowedIds.has(id))

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
