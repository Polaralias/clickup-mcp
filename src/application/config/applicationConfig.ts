import { z } from "zod"

const DEFAULT_CHAR_LIMIT = 16000
const DEFAULT_ATTACHMENT_LIMIT_MB = 8

const NumberSchema = z.number().finite().positive()

export type SessionConfigInput = {
  defaultTeamId?: string
  charLimit?: number
  maxAttachmentMb?: number
}

export type ApplicationConfig = {
  defaultTeamId?: string
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

function resolveDefaultTeamId(candidate?: string) {
  const value = candidate?.trim()
  if (value) {
    return value
  }
  const envValue = process.env.DEFAULT_TEAM_ID ?? process.env.defaultTeamId
  const trimmed = envValue?.trim()
  return trimmed || undefined
}

export function createApplicationConfig(input: SessionConfigInput): ApplicationConfig {
  const defaultTeamId = resolveDefaultTeamId(input.defaultTeamId)
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
    defaultTeamId,
    charLimit,
    maxAttachmentMb
  }
}

export function requireDefaultTeamId(config: ApplicationConfig, message: string) {
  if (config.defaultTeamId) {
    return config.defaultTeamId
  }
  throw new Error(message)
}

export function getCharLimit(config: ApplicationConfig) {
  return config.charLimit
}

export function getMaxAttachmentSizeMb(config: ApplicationConfig) {
  return config.maxAttachmentMb
}
