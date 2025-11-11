import { z } from "zod"
import { UpdateTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof UpdateTimeEntryInput>

type Result = {
  preview?: Record<string, unknown>
  entry?: Record<string, unknown>
}

function resolveTeamId(input: Input, config: ApplicationConfig) {
  if (input.teamId?.trim()) {
    return input.teamId
  }
  return requireTeamId(config, "teamId is required to update a time entry")
}

export async function updateTimeEntry(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const teamId = resolveTeamId(input, config)
  const payload: Record<string, unknown> = {}
  if (input.start !== undefined) payload.start = input.start
  if (input.end !== undefined) payload.end = input.end
  if (input.durationMs !== undefined) payload.duration = input.durationMs
  if (input.description !== undefined) payload.description = input.description

  if (input.dryRun) {
    return { preview: { entryId: input.entryId, teamId, fields: Object.keys(payload) } }
  }

  const entry = await client.updateTimeEntry(teamId, input.entryId, payload)
  return { entry }
}
