import { z } from "zod"
import { CreateTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof CreateTimeEntryInput>

type Result = {
  preview?: Record<string, unknown>
  entry?: Record<string, unknown>
}

export async function createTimeEntry(input: Input, client: ClickUpClient): Promise<Result> {
  const payload: Record<string, unknown> = {
    start: input.start,
    end: input.end,
    duration: input.durationMs,
    description: input.description
  }

  if (input.dryRun) {
    return {
      preview: {
        taskId: input.taskId,
        start: input.start,
        end: input.end,
        durationMs: input.durationMs ?? null
      }
    }
  }

  const entry = await client.createTimeEntry(input.taskId, payload)
  return { entry }
}
