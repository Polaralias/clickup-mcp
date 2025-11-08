import { z } from "zod"
import { GetWorkspaceOverviewInput } from "../../../mcp/schemas/hierarchy.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof GetWorkspaceOverviewInput>

type Result = {
  workspace: Record<string, unknown>
}

export async function getWorkspaceOverview(input: Input, client: ClickUpClient): Promise<Result> {
  const workspace = await client.getWorkspaceOverview(input.workspaceId)
  return { workspace }
}
