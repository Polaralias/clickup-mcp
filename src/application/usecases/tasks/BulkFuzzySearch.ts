import { z } from "zod"
import { BulkFuzzySearchInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { fuzzySearch } from "./FuzzySearch.js"

const DEFAULT_CONCURRENCY = 10

type Input = z.infer<typeof BulkFuzzySearchInput>

type Result = Array<{
  query: string
  results: Array<Record<string, unknown>>
  guidance?: string
}>

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

export async function bulkFuzzySearch(input: Input, client: ClickUpClient): Promise<Result> {
  const processor = new BulkProcessor<string, Result[number]>(resolveConcurrency())
  const results = await processor.run(input.queries, async (query) => {
    const result = await fuzzySearch({ query, limit: input.limit }, client)
    return { query, results: result.results, guidance: result.guidance }
  })
  return results
}
