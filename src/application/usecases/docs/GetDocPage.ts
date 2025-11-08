import { z } from "zod"
import { GetDocPageInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof GetDocPageInput>

type Result = {
  page: Record<string, unknown>
}

export async function getDocPage(input: Input, client: ClickUpClient): Promise<Result> {
  const page = await client.getDocPage(input.docId, input.pageId)
  return { page }
}
