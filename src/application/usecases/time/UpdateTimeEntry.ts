import { z } from "zod"
import { UpdateTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof UpdateTimeEntryInput>

type Result = {
  preview?: Record<string, unknown>
  entry?: Record<string, unknown>
}

export async function updateTimeEntry(input: Input, client: ClickUpClient): Promise<Result> {
  const payload: Record<string, unknown> = {}
  if (input.start !== undefined) payload.start = input.start
  if (input.end !== undefined) payload.end = input.end
  if (input.durationMs !== undefined) payload.duration = input.durationMs
  if (input.description !== undefined) payload.description = input.description

  if (input.dryRun) {
    return { preview: { entryId: input.entryId, fields: Object.keys(payload) } }
  }

  const entry = await client.updateTimeEntry(input.entryId, payload)
  return { entry }
}
