import { z } from "zod"
import { ListDocPagesInput } from "../../../mcp/schemas/docs.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListDocPagesInput>

type Result = {
  pages: unknown[]
}

export async function listDocPages(input: Input, client: ClickUpClient): Promise<Result> {
  const pages = await client.listDocPages(input.docId)
  return { pages: Array.isArray(pages?.pages) ? pages.pages : pages }
}
