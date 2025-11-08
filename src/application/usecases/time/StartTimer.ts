import { z } from "zod"
import { StartTimerInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof StartTimerInput>

type Result = {
  preview?: Record<string, unknown>
  timer?: Record<string, unknown>
}

export async function startTimer(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, action: "start" } }
  }

  const timer = await client.startTimer(input.taskId)
  return { timer }
}
