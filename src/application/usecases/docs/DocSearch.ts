import { z } from "zod"
import { DocSearchInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { DocSearchCache } from "../../services/DocSearchCache.js"
import { extractDocId, type DocRecord } from "./docUtils.js"

const DEFAULT_CONCURRENCY = 5

type Input = z.infer<typeof DocSearchInput>

type Result = {
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  guidance?: string
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for doc search")
}

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

function safeExtractDocId(doc: DocRecord) {
  try {
    return extractDocId(doc)
  } catch (error) {
    if (error instanceof Error) {
      return undefined
    }
    return undefined
  }
}

type CacheKey = {
  query: string
  limit: number
  expandPages: boolean
}

function buildCacheKey(input: Input): CacheKey {
  return { query: input.query, limit: input.limit, expandPages: input.expandPages }
}

export async function docSearch(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  cache?: DocSearchCache
): Promise<Result> {
  const teamId = resolveTeamId(config)
  const cacheKey = buildCacheKey(input)
  const cached = cache?.get(cacheKey, { forceRefresh: input.forceRefresh })
  if (cached) {
    const guidance = cached.docs.length === 0 ? "No docs found. Adjust the query or search scope." : undefined
    return { docs: cached.docs, expandedPages: cached.expandedPages, guidance }
  }

  const response = await client.searchDocs(teamId, { search: input.query, page: 0 })
  const docs = Array.isArray(response?.docs) ? response.docs : []
  const limited = docs.slice(0, input.limit)

  let expandedPages: Record<string, unknown[]> | undefined
  if (input.expandPages) {
    const processor = new BulkProcessor<any, { docId: string; pages: unknown[] }>(resolveConcurrency())
    const results = await processor.run(limited, async (doc) => {
      const docId = safeExtractDocId(doc as DocRecord) ?? (typeof doc.id === "string" ? doc.id : undefined)
      if (!docId) {
        return { docId: "", pages: [] }
      }
      const cachedPages = cache?.getDocPages(docId, { forceRefresh: input.forceRefresh })
      if (cachedPages) {
        return { docId, pages: cachedPages }
      }
      const pagesResponse = await client.listDocPages(docId)
      const pages = Array.isArray(pagesResponse?.pages) ? pagesResponse.pages : []
      return { docId, pages }
    })
    expandedPages = Object.fromEntries(
      results.filter((entry) => entry.docId).map((entry) => [entry.docId, entry.pages])
    )
  }

  cache?.store(cacheKey, { docs: limited, expandedPages })

  return {
    docs: limited,
    expandedPages,
    guidance: limited.length === 0 ? "No docs found. Adjust the query or search scope." : undefined
  }
}
