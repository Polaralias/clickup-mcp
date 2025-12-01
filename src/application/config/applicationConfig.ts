import { z } from "zod"

const DEFAULT_CHAR_LIMIT = 16000
const DEFAULT_ATTACHMENT_LIMIT_MB = 8
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

const NumberSchema = z.number().finite().positive()

export type SessionConfigInput = {
  teamId?: string
  apiKey?: string
  charLimit?: number
  maxAttachmentMb?: number
  readOnly?: boolean
  hierarchyCacheTtlMs?: number
  spaceConfigCacheTtlMs?: number
}

export type ApplicationConfig = {
  teamId: string
  apiKey: string
  charLimit: number
  maxAttachmentMb: number
  readOnly: boolean
  hierarchyCacheTtlMs: number
  spaceConfigCacheTtlMs: number
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

function parseBooleanFlag(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase()
    if (normalised === "") return undefined
    if (["1", "true", "yes", "y", "on"].includes(normalised)) return true
    if (["0", "false", "no", "n", "off"].includes(normalised)) return false
  }
  return undefined
}

function resolveBoolean(keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = parseBooleanFlag(process.env[key])
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

function resolveNonNegativeNumber(keys: string[]): number | undefined {
  for (const key of keys) {
    const value = process.env[key]
    if (value === undefined || value === "") {
      continue
    }
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
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

function resolveApiKey(candidate?: string, fallbackCandidate?: string) {
  const direct = candidate?.trim()
  if (direct) {
    return direct
  }
  const fallback = fallbackCandidate?.trim()
  if (fallback) {
    return fallback
  }
  const envValue = process.env.CLICKUP_API_TOKEN ?? process.env.clickupApiToken
  const trimmed = envValue?.trim()
  return trimmed || undefined
}

export function createApplicationConfig(input: SessionConfigInput, apiKeyCandidate?: string): ApplicationConfig {
  const teamId = resolveTeamId(input.teamId)
  if (!teamId) {
    throw new Error("teamId is required")
  }
  const apiKey = resolveApiKey(input.apiKey, apiKeyCandidate)
  if (!apiKey) {
    throw new Error("apiKey is required")
  }
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
  const readOnly =
    parseBooleanFlag(input.readOnly) ?? resolveBoolean(["READ_ONLY_MODE", "readOnlyMode", "READ_ONLY"]) ?? false
  const hierarchyCacheTtlMs = (input.hierarchyCacheTtlMs ?? resolveNonNegativeNumber(["HIERARCHY_CACHE_TTL_MS"])) ??
    (resolveNonNegativeNumber(["HIERARCHY_CACHE_TTL_SECONDS"]) ?? DEFAULT_CACHE_TTL_MS / 1000) * 1000
  const spaceConfigCacheTtlMs =
    (input.spaceConfigCacheTtlMs ?? resolveNonNegativeNumber(["SPACE_CONFIG_CACHE_TTL_MS"])) ??
    (resolveNonNegativeNumber(["SPACE_CONFIG_CACHE_TTL_SECONDS"]) ?? DEFAULT_CACHE_TTL_MS / 1000) * 1000
  return {
    teamId,
    apiKey,
    charLimit,
    maxAttachmentMb,
    readOnly,
    hierarchyCacheTtlMs,
    spaceConfigCacheTtlMs
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
