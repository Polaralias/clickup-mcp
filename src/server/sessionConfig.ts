import type { Request, Response } from "express"
import type { SessionConfigInput } from "../application/config/applicationConfig.js"

function lastString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[v.length - 1]
  return v
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
    }
  },
  required: ["teamId", "apiKey"],
  additionalProperties: false,
  exampleConfig: {
    teamId: "team_123",
    apiKey: "pk_123",
    charLimit: 16000,
    maxAttachmentMb: 8
  }
}

export async function extractSessionConfig(req: Request, res: Response): Promise<SessionConfigInput | undefined> {
  const q = req.query as Record<string, string | string[] | undefined>

  const teamId = lastString(q.teamId) || lastString(q.teamID) || lastString(q.workspaceId) || lastString(q.workspaceID)
  const apiKey = lastString(q.apiKey) || lastString(q.api_key) || lastString(q.token)

  const missing: string[] = []
  if (!teamId) missing.push("teamId")
  if (!apiKey) missing.push("apiKey")

  if (missing.length) {
    res.status(400).json({
      error: `Invalid configuration: missing ${missing.join(", ")}`
    })
    return undefined
  }

  const charLimitRaw = lastString(q.charLimit)
  const maxAttachmentMbRaw = lastString(q.maxAttachmentMb)

  const charLimit = charLimitRaw !== undefined && charLimitRaw !== "" ? Number(charLimitRaw) : undefined
  const maxAttachmentMb = maxAttachmentMbRaw !== undefined && maxAttachmentMbRaw !== "" ? Number(maxAttachmentMbRaw) : undefined

  const config: SessionConfigInput = {
    teamId,
    apiKey,
    ...(charLimit !== undefined && !Number.isNaN(charLimit) ? { charLimit } : {}),
    ...(maxAttachmentMb !== undefined && !Number.isNaN(maxAttachmentMb) ? { maxAttachmentMb } : {})
  } as SessionConfigInput

  return config
}
