import { z } from "zod"
import { ListFoldersInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListFoldersInput>

type Result = {
  folders: unknown[]
}

export async function listFolders(input: Input, client: ClickUpClient): Promise<Result> {
  const response = await client.listFolders(input.spaceId)
  return { folders: response?.folders ?? response }
}
