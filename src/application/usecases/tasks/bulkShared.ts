import { BulkProcessor } from "../../services/BulkProcessor.js"
import {
  normaliseClickUpError,
  type NormalisedClickUpError
} from "../../../infrastructure/clickup/ClickUpClient.js"

export type BulkWorker<TInput, TPayload extends Record<string, unknown>> = (
  item: TInput
) => Promise<
  | { success: true; payload: TPayload }
  | { success: false; payload: TPayload; error: NormalisedClickUpError }
>

export type BulkOutcome<TPayload extends Record<string, unknown>> = {
  index: number
  status: "success" | "failed"
  payload: TPayload
  error?: NormalisedClickUpError
}

const RESULT_PREVIEW_LIMIT = 20

export function formatError(error: unknown): NormalisedClickUpError {
  return normaliseClickUpError(error)
}

export async function runBulk<TInput, TPayload extends Record<string, unknown>>(
  items: TInput[],
  worker: BulkWorker<TInput, TPayload>,
  concurrency: number
): Promise<BulkOutcome<TPayload>[]> {
  const processor = new BulkProcessor<TInput, BulkOutcome<TPayload>>(concurrency)
  let index = 0
  return processor.run(items, async (item) => {
    const currentIndex = index
    index += 1
    try {
      const result = await worker(item)
      if (result.success) {
        return {
          index: currentIndex,
          status: "success" as const,
          payload: result.payload
        }
      }
      return {
        index: currentIndex,
        status: "failed" as const,
        payload: result.payload,
        error: result.error
      }
    } catch (error) {
      return {
        index: currentIndex,
        status: "failed" as const,
        payload: ({} as TPayload),
        error: formatError(error)
      }
    }
  })
}

export function summariseBulk<TPayload extends Record<string, unknown>>(
  outcomes: BulkOutcome<TPayload>[],
  extra: Record<string, unknown> = {}
) {
  const ordered = [...outcomes].sort((a, b) => a.index - b.index)
  const total = outcomes.length
  const succeeded = ordered.filter((outcome) => outcome.status === "success").length
  const failed = total - succeeded
  const firstError = ordered.find((outcome) => outcome.status === "failed")?.error
  const failedIndices = ordered
    .filter((outcome) => outcome.status === "failed")
    .map((outcome) => outcome.index)

  const payloadResults = ordered.map((outcome) => {
    const base: Record<string, unknown> = {
      index: outcome.index,
      status: outcome.status,
      ...outcome.payload
    }
    if (outcome.error) {
      base.error = outcome.error
    }
    return base
  })

  const preview = payloadResults.slice(0, RESULT_PREVIEW_LIMIT)
  const truncated = payloadResults.length > RESULT_PREVIEW_LIMIT

  const guidance: string[] = []
  if (failedIndices.length > 0) {
    const indexPreview = failedIndices.slice(0, 10)
    guidance.push(
      `Partial success. Retry or inspect tasks at indices: ${indexPreview.join(", ")}${
        failedIndices.length > indexPreview.length ? "…" : ""
      }`
    )
  }

  return {
    total,
    succeeded,
    failed,
    firstError,
    failedIndices: failedIndices.length ? failedIndices : undefined,
    results: payloadResults,
    preview,
    truncated,
    guidance,
    ...extra
  }
}
