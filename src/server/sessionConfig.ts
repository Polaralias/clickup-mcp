import type { Request, Response } from "express"
import { parseAndValidateConfig } from "@smithery/sdk"
import { z } from "zod"
import type { SessionConfigInput } from "../application/config/applicationConfig.js"

export const SessionConfigSchema = z.object({
  teamId: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  charLimit: z.number().positive().optional(),
  maxAttachmentMb: z.number().positive().optional()
})

type ParsedConfig = z.infer<typeof SessionConfigSchema>

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
  const result = parseAndValidateConfig(req, SessionConfigSchema)
  if (!result.ok) {
    const { error } = result
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 400
    res.status(status).json(error)
    return undefined
  }
  return result.value as ParsedConfig
}
