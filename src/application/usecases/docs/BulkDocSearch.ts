import { z } from "zod"
import { BulkDocSearchInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { BulkProcessor } from "../../services/BulkProcessor.js"
import { CapabilityTracker } from "../../services/CapabilityTracker.js"
import { docSearch } from "./DocSearch.js"
import { isDocCapabilityError, type DocCapabilityError } from "../../services/DocCapability.js"

const DEFAULT_CONCURRENCY = 5

type Input = z.infer<typeof BulkDocSearchInput>

type Result = Array<{
  query: string
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  guidance?: string
}>

type BulkDocSearchOutcome = Result | DocCapabilityError

function resolveConcurrency() {
  const limit = Number(process.env.MAX_BULK_CONCURRENCY ?? DEFAULT_CONCURRENCY)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_CONCURRENCY
}

export async function bulkDocSearch(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<BulkDocSearchOutcome> {
  const processor = new BulkProcessor<string, Result[number] | DocCapabilityError>(
    resolveConcurrency()
  )
  const results = await processor.run(input.queries, async (query) => {
    const result = await docSearch(
      {
        query,
        limit: input.limit,
        expandPages: input.expandPages,
        workspaceId: input.workspaceId
      },
      client,
      config,
      capabilityTracker
    )
    if (isDocCapabilityError(result)) {
      return result
    }
    return {
      query,
      docs: result.docs,
      expandedPages: result.expandedPages,
      guidance: result.guidance
    }
  })
  const capabilityError = results.find((entry) => isDocCapabilityError(entry))
  if (capabilityError) {
    return capabilityError
  }
  return results as Result
}
