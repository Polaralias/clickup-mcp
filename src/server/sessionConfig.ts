import type { Request, Response } from "express"
import { parseAndValidateConfig } from "@smithery/sdk"
import { z } from "zod"
import type { SessionConfigInput } from "../application/config/applicationConfig.js"

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (value === undefined || value === null) {
      return undefined
    }
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) {
        return undefined
      }
      const parsed = Number(trimmed)
      return Number.isFinite(parsed) ? parsed : value
    }
    return value
  },
  z.union([z.number().positive(), z.undefined()])
)

export const SessionConfigSchema = z.object({
  teamId: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  charLimit: optionalPositiveNumber,
  maxAttachmentMb: optionalPositiveNumber
})

type ParsedConfig = z.infer<typeof SessionConfigSchema>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function normaliseQuery(query: Request["query"]): Record<string, unknown> {
  if (!isPlainObject(query)) {
    return {}
  }

  const normalised: Record<string, unknown> = {}

  const assign = (key: string, value: unknown) => {
    if (!(key in normalised)) {
      normalised[key] = value
    }
  }

  const normaliseKey = (rawKey: string): string => {
    const dotted = rawKey.replace(/\[([^\]]+)\]/g, ".$1")
    if (dotted === "config") {
      return ""
    }
    if (dotted.startsWith("config.")) {
      return dotted.slice("config.".length)
    }
    return dotted
  }

  const handle = (key: string, value: unknown) => {
    if (!key) {
      if (isPlainObject(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          handle(normaliseKey(nestedKey), nestedValue)
        }
      }
      return
    }

    if (Array.isArray(value)) {
      assign(key, value)
      return
    }

    if (isPlainObject(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const combinedKey = `${key}.${nestedKey}`
        handle(normaliseKey(combinedKey), nestedValue)
      }
      return
    }

    assign(key, value)
  }

  for (const [rawKey, rawValue] of Object.entries(query)) {
    handle(normaliseKey(rawKey), rawValue)
  }

  return normalised
}

function extractBodyConfig(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    return {}
  }

  if (typeof body.jsonrpc === "string") {
    return {}
  }

  if (isPlainObject(body.config)) {
    return body.config
  }

  const allowedKeys = ["teamId", "apiKey", "charLimit", "maxAttachmentMb"]
  const config: Record<string, unknown> = {}

  for (const key of allowedKeys) {
    if (key in body) {
      config[key] = (body as Record<string, unknown>)[key]
    }
  }

  return config
}

export const sessionConfigJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ClickUp MCP Session Configuration",
  description: "Configuration values accepted by the ClickUp MCP server.",
  type: "object",
  "x-query-style": "dot+bracket",
  properties: {
    teamId: {
      type: "string",
      description: "ClickUp workspace ID applied to requests when a tool input omits it."
    },
    apiKey: {
      type: "string",
      description: "ClickUp personal API token used to authenticate requests made by the server."
    },
    charLimit: {
      type: "number",
      description:
        "Maximum number of characters returned in tool responses before truncation indicators are added.",
      minimum: 1
    },
    maxAttachmentMb: {
      type: "number",
      description:
        "Largest file attachment (in megabytes) the server will upload; larger files are rejected before calling ClickUp.",
      minimum: 1
    }
  },
  required: ["teamId", "apiKey"],
  additionalProperties: false
}

export async function extractSessionConfig(req: Request, res: Response): Promise<SessionConfigInput | undefined> {
  const normalisedQuery = normaliseQuery(req.query)
  const bodyConfig = extractBodyConfig(req.body)

  for (const [key, value] of Object.entries(bodyConfig)) {
    if (!(key in normalisedQuery)) {
      normalisedQuery[key] = value
    }
  }

  const requestForValidation = { ...req, query: normalisedQuery } as Request
  const result = parseAndValidateConfig(requestForValidation, SessionConfigSchema)
  if (!result.ok) {
    const { error } = result
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 400
    res.status(status).json(error)
    return undefined
  }
  return result.value as ParsedConfig
}
