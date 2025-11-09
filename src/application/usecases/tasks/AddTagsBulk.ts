import { z } from "zod"
import { AddTagsBulkInput } from "../../../mcp/schemas/task.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import { addTagsToTask } from "./AddTagsToTask.js"
import { formatError, runBulk, summariseBulk } from "./bulkShared.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"

const CONCURRENCY_LIMIT = 5

type Input = z.infer<typeof AddTagsBulkInput>

type NormalisedTagging = {
  taskId: string
  tags: string[]
}

function normaliseTags(input: Input): NormalisedTagging[] {
  const defaults = input.defaults ?? {}
  return input.tasks.map((task) => ({
    taskId: task.taskId,
    tags: task.tags ?? defaults.tags ?? []
  }))
}

export async function addTagsBulk(input: Input, client: ClickUpClient, _config: ApplicationConfig) {
  const taggings = normaliseTags(input)
  const outcomes = await runBulk(taggings, async (tagging) => {
    const payloadBase = {
      taskId: tagging.taskId,
      preview: undefined as Record<string, unknown> | undefined,
      tagsApplied: undefined as string[] | undefined,
      tagsAttempted: tagging.tags
    }
    const resultInput = {
      taskId: tagging.taskId,
      tags: tagging.tags,
      dryRun: input.dryRun ?? false,
      confirm: "yes" as const
    }

    try {
      const result = await addTagsToTask(resultInput, client)
      if (input.dryRun) {
        return {
          success: true as const,
          payload: {
            ...payloadBase,
            preview: result.preview
          }
        }
      }

      return {
        success: true as const,
        payload: {
          ...payloadBase,
          tagsApplied: tagging.tags,
          status: result.status,
          preview: undefined
        }
      }
    } catch (error) {
      return {
        success: false as const,
        payload: {
          ...payloadBase
        },
        error: formatError(error)
      }
    }
  }, CONCURRENCY_LIMIT)

  return summariseBulk(outcomes, {
    dryRun: input.dryRun ?? false,
    concurrency: CONCURRENCY_LIMIT,
    teamId: input.teamId
  })
}
