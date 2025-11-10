import type { StatusInput, HierarchyPathInput } from "../../../mcp/schemas/structure.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import {
  HierarchyDirectory,
  HierarchyEnsureOptions
} from "../../services/HierarchyDirectory.js"
import { resolvePathToIds } from "./ResolvePathToIds.js"

export type NormalisedStatus = {
  status: string
  type?: string
  color?: string
  orderindex?: number
  description?: string
}

export function normaliseStatuses(statuses?: StatusInput[]): NormalisedStatus[] | undefined {
  if (!statuses || statuses.length === 0) {
    return undefined
  }

  return statuses.map((status, index) => {
    const name = status.status ?? status.name ?? `Status ${index + 1}`
    const result: NormalisedStatus = { status: name }
    if (status.type) result.type = status.type
    if (status.color) result.color = status.color
    if (status.orderindex !== undefined) result.orderindex = status.orderindex
    if (status.description) result.description = status.description
    return result
  })
}

export function compactRecord<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== null)
  ) as Partial<T>
}

export function readString(candidate: unknown, keys: string[]): string | undefined {
  if (!candidate || typeof candidate !== "object") {
    return undefined
  }
  for (const key of keys) {
    const value = (candidate as Record<string, unknown>)[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

export type PathResolution = Awaited<ReturnType<typeof resolvePathToIds>>

export async function resolveIdsFromPath(
  path: HierarchyPathInput | undefined,
  client: ClickUpClient,
  directory: HierarchyDirectory,
  options: HierarchyEnsureOptions = {}
): Promise<PathResolution | undefined> {
  if (!path || path.length === 0) {
    return undefined
  }
  return resolvePathToIds({ path, forceRefresh: options.forceRefresh }, client, directory, options)
}
