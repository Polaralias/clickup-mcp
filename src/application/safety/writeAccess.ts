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

function collectIds(input: unknown, keys: string[]): Set<string> {
  const results = new Set<string>()
  if (!input || typeof input !== "object") return results

  if (Array.isArray(input)) {
    input.forEach((entry) => {
      const nested = collectIds(entry, keys)
      nested.forEach((id) => results.add(id))
    })
    return results
  }

  const record = input as Record<string, unknown>
  for (const key of keys) {
    if (key in record) {
      const value = record[key]
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          const id = normaliseId(entry)
          if (id) results.add(id)
        })
      } else {
        const id = normaliseId(value)
        if (id) results.add(id)
      }
    }
  }

  const containers = ["tasks", "subtasks", "defaults", "operations"]
  for (const container of containers) {
    if (container in record) {
       const nested = collectIds(record[container], keys)
       nested.forEach((id) => results.add(id))
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

  if (!spaceIds.size && !listIds.size) {
    const taskIds = collectIds(input, ["taskId", "parentTaskId"])
    if (taskIds.size > 0) {
      // Limit to first 5 to avoid API flood
      const idsToCheck = [...taskIds].slice(0, 5)
      for (const id of idsToCheck) {
        try {
          const derived = await resolveTaskContext(id, client)
          derived.listIds.forEach((id) => listIds.add(id))
          derived.spaceIds.forEach((id) => spaceIds.add(id))
        } catch {
          // Ignore failures for individual tasks
        }
      }
    }
  }

  if (listIds.size && access.allowedSpaces.size) {
    const derived = await resolveListSpaces(listIds, client)
    derived.spaceIds.forEach((id) => spaceIds.add(id))
  }

  if (!spaceIds.size && !listIds.size) {
    const docIds = collectIds(input, ["docId", "documentId"])
    if (docIds.size > 0) {
      // Limit resolution
      const idsToCheck = [...docIds].slice(0, 5)
      for (const id of idsToCheck) {
         const derived = await resolveDocContext(id, config.teamId, client)
         derived.listIds.forEach((id) => listIds.add(id))
         derived.spaceIds.forEach((id) => spaceIds.add(id))
      }
    }
  }

  const hasAllowedSpace = [...spaceIds].some((id) => access.allowedSpaces.has(id))
  const hasAllowedList = [...listIds].some((id) => access.allowedLists.has(id))

  if (hasAllowedSpace || hasAllowedList) {
    return
  }

  console.log("Write access denied:", {
    resolvedSpaceIds: [...spaceIds],
    resolvedListIds: [...listIds]
  })

  if (!spaceIds.size && !listIds.size) {
    throw new Error(
      "Write operations are restricted to explicitly allowed spaces or lists. Include a spaceId or listId to proceed."
    )
  }

  throw new Error(
    "Write operations are limited to explicitly allowed spaces or lists. Provided context was not permitted."
  )
}
