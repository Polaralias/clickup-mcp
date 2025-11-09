import { z } from "zod"
import { DeleteViewInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof DeleteViewInput>

type Result = {
  preview?: Record<string, unknown>
  status?: string
  viewId?: string
  nextSteps: string[]
}

export async function deleteView(input: Input, client: ClickUpClient): Promise<Result> {
  const nextSteps = [
    "Call clickup_get_workspace_overview or relevant list tools to confirm the view is gone.",
    "Create a new view with clickup_create_list_view or clickup_create_space_view if required."
  ]

  if (input.dryRun) {
    return {
      preview: { action: "delete", viewId: input.viewId },
      nextSteps
    }
  }

  await client.deleteView(input.viewId)
  return {
    status: "deleted",
    viewId: input.viewId,
    nextSteps
  }
}
