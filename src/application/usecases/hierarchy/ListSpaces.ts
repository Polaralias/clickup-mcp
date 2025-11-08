import { z } from "zod"
import { ListSpacesInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof ListSpacesInput>

type Result = {
  spaces: unknown[]
}

export async function listSpaces(input: Input, client: ClickUpClient): Promise<Result> {
  const response = await client.listSpaces(input.workspaceId)
  return { spaces: response?.spaces ?? response }
}
