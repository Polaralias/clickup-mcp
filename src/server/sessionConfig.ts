import type { Request, Response } from "express"
import type { SessionConfigInput } from "../application/config/applicationConfig.js"

function lastString(v: unknown): string | undefined {
  if (Array.isArray(v)) {
    const last = v[v.length - 1]
    return typeof last === "string" ? last : undefined
  }
  return typeof v === "string" ? v : undefined
}

function parseBooleanFlag(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") return undefined
  const normalised = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(normalised)) return true
  if (["0", "false", "no", "n", "off"].includes(normalised)) return false
  return undefined
}

function parseWriteMode(value: string | undefined): "write" | "read" | "selective" | undefined {
  if (value === undefined || value === "") return undefined
  const normalised = value.trim().toLowerCase()
  if (["write", "read", "selective"].includes(normalised)) {
    return normalised as "write" | "read" | "selective"
  }
  return undefined
}

function parseIdList(value: unknown): string[] | undefined {
  let values: unknown[] = []

  if (Array.isArray(value)) {
    values = value
  } else if (typeof value === "string") {
    values = [value]
  } else if (value && typeof value === "object") {
    values = Object.values(value)
  } else if (value !== undefined && value !== null) {
    values = [value]
  } else {
    return undefined
  }

  const parsed = values
    .flatMap((entry) => {
      if (typeof entry === "string") {
        const trimmed = entry.trim()
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsedJson = JSON.parse(trimmed)
            if (Array.isArray(parsedJson)) {
              return parsedJson.map(String)
            }
          } catch {
            // Ignore JSON parse errors, treat as comma-separated string
          }
        }
        return entry.split(/[,\s]+/)
      }
      if (typeof entry === "number") {
        return String(entry)
      }
      return ""
    })
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  // Deduplicate
  const unique = Array.from(new Set(parsed))
  return unique.length ? unique : undefined
}

function extractArrayValues(q: Record<string, unknown>, targetKeys: string[]): unknown[] | undefined {
  const values: unknown[] = []
  const indexedEntries: { index: number; value: unknown }[] = []

  const targets = new Set(targetKeys.map((k) => k.toLowerCase()))

  for (const key of Object.keys(q)) {
    const lowerKey = key.toLowerCase()

    // Check for exact/case-insensitive base match
    if (targets.has(lowerKey)) {
      const val = q[key]
      if (Array.isArray(val)) {
        values.push(...val)
      } else {
        values.push(val)
      }
      continue
    }

    // Check for indexed variants
    for (const target of targets) {
      // Check for dot notation: target.N
      if (lowerKey.startsWith(target + ".")) {
        const rest = lowerKey.slice(target.length + 1)
        if (/^\d+$/.test(rest)) {
          const index = parseInt(rest, 10)
          indexedEntries.push({ index, value: q[key] })
          break
        }
      }
      // Check for bracket notation: target[N]
      else if (lowerKey.startsWith(target + "[") && lowerKey.endsWith("]")) {
        const inner = lowerKey.slice(target.length + 1, -1)
        if (/^\d+$/.test(inner)) {
          const index = parseInt(inner, 10)
          indexedEntries.push({ index, value: q[key] })
          break
        }
      }
    }
  }

  // Sort indexed entries and append
  indexedEntries.sort((a, b) => a.index - b.index)
  for (const entry of indexedEntries) {
    values.push(entry.value)
  }

  return values.length > 0 ? values : undefined
}

export const sessionConfigJsonSchema = {
  $schema: "https://json-schema.org/draft-07/schema",
  $id: "https://clickup-mcp-server/.well-known/mcp-config",
  title: "MCP Session Configuration",
  description: "Schema for the /mcp endpoint configuration",
  type: "object",
  "x-query-style": "dot+bracket",
  properties: {
    teamId: {
      type: "string",
      description: "ClickUp workspace ID applied when tool inputs omit one"
    },
    apiKey: {
      type: "string",
      description: "ClickUp personal API token used for all API requests"
    },
    charLimit: {
      type: "number",
      description: "Maximum characters returned before responses are truncated"
    },
    maxAttachmentMb: {
      type: "number",
      description: "Largest file attachment (MB) allowed for uploads"
    },
    readOnly: {
      type: "boolean",
      description: "When true, all write operations are disabled. Takes precedence over other write settings."
    },
    selectiveWrite: {
      type: "boolean",
      description: "When true, write access is restricted to specific lists or spaces defined in writeLists and writeSpaces. If false (and not readOnly), full write access is granted."
    },
    writeSpaces: {
      type: "array",
      items: { type: "string" },
      description: "Space IDs where write operations are permitted; writes elsewhere are blocked"
    },
    writeLists: {
      type: "array",
      items: { type: "string" },
      description: "List IDs where write operations are permitted; writes elsewhere are blocked"
    }
  },
  required: ["teamId", "apiKey"],
  additionalProperties: false,
  exampleConfig: {
    teamId: "team_123",
    apiKey: "pk_123",
    charLimit: 16000,
    maxAttachmentMb: 8,
    selectiveWrite: false,
    readOnly: false,
    writeSpaces: [],
    writeLists: []
  }
}

export async function extractSessionConfig(req: Request, res: Response): Promise<SessionConfigInput | undefined> {
  const q = req.query as Record<string, unknown>

  // Log configuration request for debugging
  const sanitizedQuery = { ...q }
  // Redact sensitive keys
  for (const key of Object.keys(sanitizedQuery)) {
    if (key.toLowerCase().includes("api") || key.toLowerCase().includes("token") || key.toLowerCase().includes("key")) {
      sanitizedQuery[key] = "***"
    }
  }
  console.log("Session Config Request:", JSON.stringify(sanitizedQuery))

  const findParam = (keys: string[]) => {
    // Exact match
    for (const key of keys) {
      if (q[key] !== undefined) return q[key]
    }
    // Case insensitive match
    const searchKeys = new Set(keys.map(k => k.toLowerCase()))
    for (const key of Object.keys(q)) {
      if (searchKeys.has(key.toLowerCase())) return q[key]
    }
    return undefined
  }

  const teamIdRaw = findParam(["teamId", "teamID", "workspaceId", "workspaceID"])
  const apiKeyRaw = findParam(["apiKey", "clickupApiToken", "api_key"])

  const teamId = lastString(teamIdRaw)
  const apiKey = lastString(apiKeyRaw)

  const missing: string[] = []
  if (!teamId) missing.push("teamId")
  if (!apiKey) missing.push("apiKey")

  if (missing.length) {
    res.status(400).json({
      error: `Invalid configuration: missing ${missing.join(", ")}`
    })
    return undefined
  }

  const charLimitRaw = lastString(findParam(["charLimit", "char-limit"]))
  const maxAttachmentMbRaw = lastString(findParam(["maxAttachmentMb", "max-attachment-mb"]))
  const readOnlyRaw = lastString(findParam(["readOnly", "read-only"]))
  const selectiveWriteRaw = lastString(findParam(["selectiveWrite", "selective-write"]))
  const writeModeRaw = lastString(findParam(["writeMode", "write-mode"]))

  const writeSpacesRaw = extractArrayValues(q, ["writeSpaces", "writeAllowedSpaces", "write_spaces", "write-spaces"])
  const writeListsRaw = extractArrayValues(q, ["writeLists", "writeAllowedLists", "write_lists", "write-lists"])

  const charLimit = charLimitRaw !== undefined && charLimitRaw !== "" ? Number(charLimitRaw) : undefined
  const maxAttachmentMb = maxAttachmentMbRaw !== undefined && maxAttachmentMbRaw !== "" ? Number(maxAttachmentMbRaw) : undefined
  const readOnly = parseBooleanFlag(readOnlyRaw)
  const selectiveWrite = parseBooleanFlag(selectiveWriteRaw)
  const writeMode = parseWriteMode(writeModeRaw)
  const writeSpaces = parseIdList(writeSpacesRaw)
  const writeLists = parseIdList(writeListsRaw)

  const config: SessionConfigInput = {
    teamId,
    apiKey,
    ...(charLimit !== undefined && !Number.isNaN(charLimit) ? { charLimit } : {}),
    ...(maxAttachmentMb !== undefined && !Number.isNaN(maxAttachmentMb) ? { maxAttachmentMb } : {}),
    ...(readOnly !== undefined ? { readOnly } : {}),
    ...(selectiveWrite !== undefined ? { selectiveWrite } : {}),
    ...(writeMode ? { writeMode } : {}),
    ...(writeSpaces ? { writeSpaces } : {}),
    ...(writeLists ? { writeLists } : {})
  } as SessionConfigInput

  return config
}
