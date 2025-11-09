import { z } from "zod"
import { GetCurrentTimeEntryInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireDefaultTeamId } from "../../config/applicationConfig.js"

type Input = z.infer<typeof GetCurrentTimeEntryInput>

type Result = {
  teamId: string
  entry: Record<string, unknown> | null
  active: boolean
  guidance: string
}

function resolveTeamId(input: Input, config: ApplicationConfig): string {
  if (input.teamId) {
    return input.teamId
  }
  return requireDefaultTeamId(config, "defaultTeamId is required to resolve the current timer")
}

function normaliseEntry(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>
  }
  return null
}

export async function getCurrentTimeEntry(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig
): Promise<Result> {
  const teamId = resolveTeamId(input, config)
  const response = await client.getCurrentTimeEntry(teamId)
  const entry = normaliseEntry(response?.data)
  const active = entry !== null && Object.keys(entry).length > 0
  const guidance = active
    ? "Active timer returned. Stop or update it before starting another timer for the same user."
    : "No active timer for this workspace. Start a timer or create a manual entry if needed."

  return { teamId, entry, active, guidance }
}
