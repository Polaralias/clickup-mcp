import { z } from "zod"
import { BulkDocSearchInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { docSearch } from "./DocSearch.js"

const DEFAULT_CONCURRENCY = 5

type Input = z.infer<typeof BulkDocSearchInput>

type Result = Array<{
  query: string
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  guidance?: string
}>

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

export async function bulkDocSearch(input: Input, client: ClickUpClient): Promise<Result> {
  const processor = new BulkProcessor<string, Result[number]>(resolveConcurrency())
  const results = await processor.run(input.queries, async (query) => {
    const result = await docSearch({ query, limit: input.limit, expandPages: input.expandPages }, client)
    return {
      query,
      docs: result.docs,
      expandedPages: result.expandedPages,
      guidance: result.guidance
    }
  })
  return results
}
