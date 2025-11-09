import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireDefaultTeamId } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { extractPageId } from "./docUtils.js"

const DEFAULT_CONCURRENCY = 5
const DEFAULT_PAGE_BATCH_SIZE = 10

type PageRecord = Record<string, unknown>

type Chunk<T> = T[]

export function resolveWorkspaceId(workspaceId: string | undefined, config: ApplicationConfig, message: string) {
  if (workspaceId) {
    return workspaceId
  }
  return requireDefaultTeamId(config, message)
}

export function resolveConcurrency() {
  const candidate = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(candidate) && candidate > 0 ? candidate : DEFAULT_CONCURRENCY
}

export function resolvePageBatchSize() {
  const candidate = Number(process.env.DOC_PAGE_BATCH_SIZE ?? DEFAULT_PAGE_BATCH_SIZE)
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return DEFAULT_PAGE_BATCH_SIZE
  }
  return Math.min(candidate, 25)
}

export function chunkArray<T>(items: T[], size: number): Array<Chunk<T>> {
  if (size <= 0) {
    return [items]
  }
  const chunks: Array<Chunk<T>> = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export async function fetchPages(client: ClickUpClient, docId: string, pageIds: string[]) {
  if (pageIds.length === 0) {
    return [] as PageRecord[]
  }
  const chunks = chunkArray(pageIds, resolvePageBatchSize())
  const processor = new BulkProcessor<string[], PageRecord[]>(resolveConcurrency())
  const responses = await processor.run(chunks, async (ids) => {
    if (ids.length === 0) {
      return []
    }
    const response = await client.bulkGetDocumentPages(docId, ids)
    const pages = Array.isArray(response?.pages) ? response.pages : response
    if (!Array.isArray(pages)) {
      return []
    }
    return pages as PageRecord[]
  })
  return responses.flat()
}

export function orderMetadata(metadata: PageRecord[], pageIds?: string[]) {
  if (!pageIds || pageIds.length === 0) {
    return metadata
  }
  const map = new Map<string, PageRecord>()
  for (const entry of metadata) {
    const pageId = extractPageId(entry)
    if (pageId && !map.has(pageId)) {
      map.set(pageId, entry)
    }
  }
  const ordered: PageRecord[] = []
  for (const rawId of pageIds) {
    const pageId = typeof rawId === "string" ? rawId.trim() : undefined
    if (!pageId || ordered.some((item) => extractPageId(item) === pageId)) {
      continue
    }
    const entry = map.get(pageId)
    if (entry) {
      ordered.push(entry)
      continue
    }
    ordered.push({ id: pageId, page_id: pageId })
  }
  return ordered
}
