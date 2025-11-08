import { Buffer } from "node:buffer"
import { z } from "zod"
import { AttachFileInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof AttachFileInput>

type Result = {
  preview?: Record<string, unknown>
  attachment?: Record<string, unknown>
}

const DEFAULT_MAX_MB = 8

function resolveLimitMb() {
  const limit = Number(process.env.MAX_ATTACHMENT_MB ?? DEFAULT_MAX_MB)
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_MAX_MB
}

function parseDataUri(dataUri: string) {
  const parts = dataUri.split(",", 2)
  if (parts.length !== 2) {
    throw new Error("Invalid data URI")
  }
  const header = parts[0]
  const data = parts[1]
  const isBase64 = header.endsWith(";base64")
  const buffer = Buffer.from(data, isBase64 ? "base64" : "utf8")
  return buffer
}

export async function attachFileToTask(input: Input, client: ClickUpClient): Promise<Result> {
  const buffer = parseDataUri(input.dataUri)
  const limitBytes = resolveLimitMb() * 1024 * 1024
  if (buffer.byteLength > limitBytes) {
    throw new Error(`Attachment exceeds limit of ${resolveLimitMb()}MB`)
  }

  if (input.dryRun) {
    return {
      preview: {
        taskId: input.taskId,
        filename: input.filename,
        sizeBytes: buffer.byteLength
      }
    }
  }

  const blob = new Blob([buffer])
  const form = new FormData()
  form.append("attachment", blob, input.filename)
  const attachment = await client.attachFile(input.taskId, form)
  return { attachment }
}
