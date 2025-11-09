import { z } from "zod"
import { GetTaskTimeEntriesInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { truncateList } from "../../limits/truncation.js"

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed
    }
  }
  return undefined
}

function extractDuration(entry: unknown): number {
  if (!entry || typeof entry !== "object") {
    return 0
  }
  const record = entry as Record<string, unknown>
  const candidates = ["duration", "durationMs", "duration_ms"]
  for (const key of candidates) {
    const duration = toNumber(record[key])
    if (duration !== undefined) {
      return duration
    }
  }
  return 0
}

type Input = z.infer<typeof GetTaskTimeEntriesInput>

type Result = {
  taskId: string
  entries: unknown[]
  entryCount: number
  totalDurationMs: number
  truncated: boolean
  guidance: string
}

export async function getTaskTimeEntries(input: Input, client: ClickUpClient): Promise<Result> {
  const response = await client.getTaskTimeEntries(input.taskId)
  const rawEntries = Array.isArray(response?.data) ? response.data : []
  const entryCount = rawEntries.length
  const totalDurationMs = rawEntries.reduce((total, entry) => total + extractDuration(entry), 0)
  const { items, truncated } = truncateList(rawEntries, input.pageSize)
  const guidance = truncated
    ? `Showing the first ${items.length} of ${entryCount} entries. Increase pageSize (max 100) for more detail.`
    : entryCount === 0
      ? "No time entries recorded for this task."
      : "All time entries for this task are included."

  return {
    taskId: input.taskId,
    entries: items,
    entryCount,
    totalDurationMs,
    truncated,
    guidance
  }
}
