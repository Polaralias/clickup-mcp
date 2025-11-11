import { z } from "zod"
import { DeleteTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof DeleteTimeEntryInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
}

function resolveTeamId(input: Input, config: ApplicationConfig) {
  if (input.teamId?.trim()) {
    return input.teamId
  }
  return requireTeamId(config, "teamId is required to delete a time entry")
}

export async function deleteTimeEntry(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const teamId = resolveTeamId(input, config)

  if (input.dryRun) {
    return { preview: { entryId: input.entryId, teamId } }
  }

  await client.deleteTimeEntry(teamId, input.entryId)
  return { status: "deleted" }
}
