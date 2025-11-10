import { z } from "zod"

const DEFAULT_CHAR_LIMIT = 16000
const DEFAULT_ATTACHMENT_LIMIT_MB = 8

const NumberSchema = z.number().finite().positive()

export type SessionConfigInput = {
  teamId?: string
  apiKey?: string
  charLimit?: number
  maxAttachmentMb?: number
}

export type ApplicationConfig = {
  teamId?: string
  apiKey?: string
  charLimit: number
  maxAttachmentMb: number
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && NumberSchema.safeParse(value).success) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (NumberSchema.safeParse(parsed).success) {
      return parsed
    }
  }
  return undefined
}

function coalesceNumber(candidate: unknown, ...fallbacks: Array<() => number | undefined>) {
  const parsed = parsePositiveNumber(candidate)
  if (parsed !== undefined) {
    return parsed
  }
  for (const fallback of fallbacks) {
    const value = fallback()
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function resolveEnvNumber(keys: string[]): number | undefined {
  for (const key of keys) {
    const value = process.env[key]
    const parsed = parsePositiveNumber(value)
    if (parsed !== undefined) {
      return parsed
    }
  }
  return undefined
}

function resolveTeamId(candidate?: string) {
  const value = candidate?.trim()
  if (value) {
    return value
  }
  const envValue =
    process.env.TEAM_ID ??
    process.env.teamId ??
    process.env.DEFAULT_TEAM_ID ??
    process.env.defaultTeamId
  const trimmed = envValue?.trim()
  return trimmed || undefined
}

function resolveApiKey(candidate?: string) {
  const value = candidate?.trim()
  if (value) {
    return value
  }
  const envValue = process.env.CLICKUP_API_TOKEN ?? process.env.clickupApiToken
  const trimmed = envValue?.trim()
  return trimmed || undefined
}

export function createApplicationConfig(input: SessionConfigInput): ApplicationConfig {
  const teamId = resolveTeamId(input.teamId)
  const apiKey = resolveApiKey(input.apiKey)
  const charLimit = coalesceNumber(
    input.charLimit,
    () => resolveEnvNumber(["CHAR_LIMIT", "charLimit"]),
    () => DEFAULT_CHAR_LIMIT
  ) ?? DEFAULT_CHAR_LIMIT
  const maxAttachmentMb = coalesceNumber(
    input.maxAttachmentMb,
    () => resolveEnvNumber(["MAX_ATTACHMENT_MB", "maxAttachmentMb"]),
    () => DEFAULT_ATTACHMENT_LIMIT_MB
  ) ?? DEFAULT_ATTACHMENT_LIMIT_MB
  return {
    teamId,
    apiKey,
    charLimit,
    maxAttachmentMb
  }
}

export function requireTeamId(config: ApplicationConfig, message: string) {
  const teamId = config.teamId?.trim()
  if (teamId) {
    return teamId
  }
  throw new Error(message)
}

export function getCharLimit(config: ApplicationConfig) {
  return config.charLimit
}

export function getMaxAttachmentSizeMb(config: ApplicationConfig) {
  return config.maxAttachmentMb
}
