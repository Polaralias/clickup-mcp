import { z } from "zod"
import { ListListsInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListListsInput>

type Result = {
  lists: unknown[]
}

export async function listLists(input: Input, client: ClickUpClient): Promise<Result> {
  const response = await client.listLists(input.spaceId ?? "", input.folderId)
  return { lists: response?.lists ?? response }
}
