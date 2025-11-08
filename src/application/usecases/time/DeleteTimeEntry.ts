import { z } from "zod"
import { DeleteTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof DeleteTimeEntryInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

export async function deleteTimeEntry(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { entryId: input.entryId } }
  }

  await client.deleteTimeEntry(input.entryId)
  return { status: "deleted" }
}
