import { z } from "zod"
import { UpdateViewInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { compactRecord, normaliseStatuses, readString } from "./structureShared.js"

type Input = z.infer<typeof UpdateViewInput>

type Result = {
  preview?: Record<string, unknown>
  view?: Record<string, unknown>
  nextSteps: string[]
}

export async function updateView(input: Input, client: ClickUpClient): Promise<Result> {
  const statuses = normaliseStatuses(input.statuses)
  const statusFilters = statuses?.map((status) => status.status)
  const nextSteps = [
    "Open the view in ClickUp to confirm the updated configuration.",
    "Use clickup_create_task or adjust filters if more refinement is needed."
  ]

  if (input.dryRun) {
    return {
      preview: {
        action: "update",
        viewId: input.viewId,
        updates: compactRecord({
          name: input.name,
          viewType: input.viewType,
          description: input.description,
          statusFilters: statusFilters ?? undefined
        })
      },
      nextSteps
    }
  }

  const payload = compactRecord({
    name: input.name,
    type: input.viewType,
    filters: statusFilters ? { statuses: statusFilters } : undefined,
    settings: input.description ? { description: input.description } : undefined
  })

  const view = await client.updateView(input.viewId, payload)
  const viewUrl = readString(view, ["url", "view_url"])

  const summary = compactRecord({
    id: input.viewId,
    name: readString(view, ["name"]) ?? input.name,
    url: viewUrl,
    description: input.description,
    type: input.viewType,
    statusFilters: statusFilters ?? undefined
  })

  return {
    view: summary,
    nextSteps
  }
}
