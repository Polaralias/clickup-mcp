import { z } from "zod"
import { DocSearchInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"

const DEFAULT_CONCURRENCY = 5

type Input = z.infer<typeof DocSearchInput>

type Result = {
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  guidance?: string
}

function resolveTeamId() {
  const team = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  if (!team) {
    throw new Error("DEFAULT_TEAM_ID is required for doc search")
  }
  return team
}

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

export async function docSearch(input: Input, client: ClickUpClient): Promise<Result> {
  const teamId = resolveTeamId()
  const response = await client.searchDocs(teamId, { search: input.query, page: 0 })
  const docs = Array.isArray(response?.docs) ? response.docs : []
  const limited = docs.slice(0, input.limit)

  let expandedPages: Record<string, unknown[]> | undefined
  if (input.expandPages) {
    const processor = new BulkProcessor<any, { docId: string; pages: unknown[] }>(resolveConcurrency())
    const results = await processor.run(limited, async (doc) => {
      const docId = doc.id ?? doc.doc_id
      const pagesResponse = await client.listDocPages(docId)
      const pages = Array.isArray(pagesResponse?.pages) ? pagesResponse.pages : []
      return { docId, pages }
    })
    expandedPages = Object.fromEntries(results.map((entry) => [entry.docId, entry.pages]))
  }

  return {
    docs: limited,
    expandedPages,
    guidance: limited.length === 0 ? "No docs found. Adjust the query or search scope." : undefined
  }
}
