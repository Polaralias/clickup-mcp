import { z } from "zod"
import { CreateDocInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { DocSearchCache } from "../../services/DocSearchCache.js"

type Input = z.infer<typeof CreateDocInput>

type Result = {
  preview?: Record<string, unknown>
  doc?: Record<string, unknown>
}

export async function createDoc(
  input: Input,
  client: ClickUpClient,
  cache?: DocSearchCache
): Promise<Result> {
  if (input.dryRun) {
    return {
      preview: {
        folderId: input.folderId,
        name: input.name,
        hasContent: Boolean(input.content)
      }
    }
  }

  const payload: Record<string, unknown> = {
    name: input.name,
    content: input.content
  }
  const doc = await client.createDoc(input.folderId, payload)
  cache?.invalidateAll()
  return { doc }
}
