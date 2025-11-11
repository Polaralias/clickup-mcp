import { z } from "zod"
import { DocSearchInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { extractDocId as resolveDocId } from "./docUtils.js"

const DEFAULT_CONCURRENCY = 5

type Input = z.infer<typeof DocSearchInput>

type Result = {
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  guidance?: string
}

function normaliseLimit(rawLimit: number) {
  return Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10
}

function extractDocId(doc: Record<string, unknown>) {
  try {
    return resolveDocId(doc)
  } catch {
    return undefined
  }
}

function buildPageSignature(docs: Array<Record<string, unknown>>) {
  const ids = docs
    .map((doc) => extractDocId(doc))
    .filter((id): id is string => typeof id === "string" && id.length > 0)
  if (ids.length === 0) {
    return undefined
  }
  return ids.join("|")
}

function resolveTeamId(config: ApplicationConfig) {
  return requireTeamId(config, "teamId is required for doc search")
}

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

export async function docSearch(input: Input, client: ClickUpClient, config: ApplicationConfig): Promise<Result> {
  const teamId = resolveTeamId(config)
  const limit = normaliseLimit(input.limit)
  const collected: Array<Record<string, unknown>> = []
  const seenIds = new Set<string>()
  const seenSignatures = new Set<string>()
  let exhausted = false

  for (let page = 0; collected.length < limit; page += 1) {
    const response = await client.searchDocs(teamId, { search: input.query, page })
    const docs = Array.isArray(response?.docs) ? response.docs : []
    if (docs.length === 0) {
      exhausted = true
      break
    }

    const signature = buildPageSignature(docs)
    if (signature && seenSignatures.has(signature)) {
      exhausted = true
      break
    }
    if (signature) {
      seenSignatures.add(signature)
    }

    const newDocs = docs.filter((doc) => {
      const docId = extractDocId(doc)
      if (!docId) {
        return true
      }
      if (seenIds.has(docId)) {
        return false
      }
      seenIds.add(docId)
      return true
    })

    if (newDocs.length === 0) {
      exhausted = true
      break
    }

    collected.push(...newDocs)
  }

  const limited = collected.slice(0, limit)

  let expandedPages: Record<string, unknown[]> | undefined
  if (input.expandPages && limited.length > 0) {
    const processor = new BulkProcessor<any, { docId: string; pages: unknown[] }>(resolveConcurrency())
    const results = await processor.run(limited, async (doc) => {
      const docId = extractDocId(doc) ?? ""
      const pagesResponse = await client.listDocPages(docId)
      const pages = Array.isArray(pagesResponse?.pages) ? pagesResponse.pages : []
      return { docId, pages }
    })
    expandedPages = Object.fromEntries(results.map((entry) => [entry.docId, entry.pages]))
  }

  let guidance: string | undefined
  if (limited.length === 0) {
    guidance = "No docs found. Adjust the query or search scope."
  } else if (!exhausted && collected.length >= limit) {
    guidance = "More docs available. Increase limit or refine the query to narrow results."
  }

  return { docs: limited, expandedPages, guidance }
}
