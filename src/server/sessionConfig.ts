import type { Request, Response } from "express"
import { parseAndValidateConfig } from "@smithery/sdk"
import { z } from "zod"
import type { SessionConfigInput } from "../application/config/applicationConfig.js"

export const SessionConfigSchema = z.object({
  defaultTeamId: z.string().trim().min(1).optional(),
  charLimit: z.number().positive().optional(),
  maxAttachmentMb: z.number().positive().optional()
})

type ParsedConfig = z.infer<typeof SessionConfigSchema>

export const sessionConfigJsonSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "ClickUp MCP Session Configuration",
  description: "Configuration values accepted by the ClickUp MCP server.",
  type: "object",
  "x-query-style": "dot+bracket",
  properties: {
    defaultTeamId: {
      type: "string",
      description: "Default ClickUp workspace ID used when a tool input does not provide one."
    },
    charLimit: {
      type: "number",
      description: "Character budget for responses before truncation.",
      minimum: 1
    },
    maxAttachmentMb: {
      type: "number",
      description: "Maximum attachment size allowed when uploading files (MB).",
      minimum: 1
    }
  },
  required: [] as string[],
  additionalProperties: false
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
