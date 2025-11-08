import { z } from "zod"
import { ListTagsForSpaceInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListTagsForSpaceInput>

type Result = {
  tags: unknown[]
}

export async function listTagsForSpace(input: Input, client: ClickUpClient): Promise<Result> {
  const response = await client.listTagsForSpace(input.spaceId)
  return { tags: response?.tags ?? response }
}
