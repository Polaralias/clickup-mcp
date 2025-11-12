import { z } from "zod"
import { ListMembersInput } from "../../../mcp/schemas/hierarchy.js"
import {
  ClickUpClient,
  ClickUpMembersFallbackError,
  type ClickUpMemberListing
} from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { requireTeamId } from "../../config/applicationConfig.js"
import { CapabilityTracker, type MemberEndpointCapability } from "../../services/CapabilityTracker.js"

type Input = z.infer<typeof ListMembersInput>

type Result = {
  members: unknown[]
  guidance?: string
  capabilities?: {
    memberEndpoint: MemberEndpointCapability
  }
}

function resolveTeamId(config: ApplicationConfig, teamId?: string) {
  if (teamId?.trim()) {
    return teamId
  }
  return requireTeamId(config, "teamId is required when a tool input does not provide one")
}

export async function listMembers(
  input: Input,
  client: ClickUpClient,
  config: ApplicationConfig,
  capabilityTracker: CapabilityTracker
): Promise<Result> {
  const teamId = resolveTeamId(config, input.teamId)

  try {
    const response = await client.listMembers(teamId)
    const listing = normaliseListing(response)
    const capability = capabilityTracker.recordMemberEndpoint(
      teamId,
      listing.source === "direct",
      listing.diagnostics
    )
    const guidance = listing.source === "fallback"
      ? "Direct member listing returned 404, so these members came from the /team fallback. Share the workspace with the API token if names are missing."
      : undefined
    return {
      members: listing.members,
      guidance,
      capabilities: { memberEndpoint: capability }
    }
  } catch (error) {
    if (error instanceof ClickUpMembersFallbackError) {
      const detail = safeErrorMessage(error.cause)
      capabilityTracker.recordMemberEndpoint(teamId, false, detail)
      const suffix = detail ? ` Underlying error: ${detail}` : ""
      throw new Error(
        `Failed to list members for workspace ${teamId}. Both the /team/${teamId}/member endpoint and the /team fallback failed. Verify the workspace exists and is shared with the configured ClickUp API token.${suffix}`
      )
    }
    throw error
  }
}

type NormalisedListing = Pick<ClickUpMemberListing, "members" | "source" | "diagnostics">

function normaliseListing(response: unknown): NormalisedListing {
  if (isClickUpMemberListing(response)) {
    return {
      members: response.members,
      source: response.source,
      diagnostics: response.diagnostics
    }
  }

  if (Array.isArray(response)) {
    return { members: response, source: "direct" }
  }

  const members = Array.isArray((response as { members?: unknown[] } | undefined)?.members)
    ? ((response as { members?: unknown[] }).members ?? [])
    : []
  return { members, source: "direct" }
}

function isClickUpMemberListing(value: unknown): value is ClickUpMemberListing {
  if (!value || typeof value !== "object") {
    return false
  }
  const candidate = value as ClickUpMemberListing
  return Array.isArray(candidate.members) && (candidate.source === "direct" || candidate.source === "fallback")
}

function safeErrorMessage(error: unknown) {
  if (!error) {
    return undefined
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  try {
    return JSON.stringify(error)
  } catch {
    return undefined
  }
}
