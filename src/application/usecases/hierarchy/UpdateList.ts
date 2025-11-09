import { z } from "zod"
import { UpdateListInput } from "../../../mcp/schemas/structure.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { compactRecord, normaliseStatuses, readString, resolveIdsFromPath } from "./structureShared.js"

type Input = z.infer<typeof UpdateListInput>

type Result = {
  preview?: Record<string, unknown>
  list?: Record<string, unknown>
  nextSteps: string[]
}

export async function updateList(input: Input, client: ClickUpClient): Promise<Result> {
  const resolution = await resolveIdsFromPath(input.path, client)
  const listId = input.listId ?? resolution?.listId
  if (!listId) {
    throw new Error("Provide listId or include a list segment in path")
  }

  const statuses = normaliseStatuses(input.statuses)
  const nextSteps = [
    "Call clickup_list_tasks_in_list to review tasks with the updated configuration.",
    "Use clickup_create_task to add tasks that match the revised statuses."
  ]

  if (input.dryRun) {
    return {
      preview: {
        action: "update",
        listId,
        updates: compactRecord({
          name: input.name,
          description: input.description,
          statusCount: statuses?.length ?? undefined
        })
      },
      nextSteps
    }
  }

  const payload = compactRecord({
    name: input.name,
    content: input.description,
    statuses,
    override_statuses: statuses ? true : undefined
  })

  const list = await client.updateList(listId, payload)
  const listUrl = readString(list, ["url", "list_url", "view_url"])

  const summary = compactRecord({
    id: listId,
    name: readString(list, ["name"]) ?? input.name,
    url: listUrl,
    description: input.description
  })

  return {
    list: summary,
    nextSteps
  }
}
