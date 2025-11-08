import { z } from "zod"
import { StopTimerInput } from "../../../mcp/schemas/time.js"
import { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"

type Input = z.infer<typeof StopTimerInput>

type Result = {
  preview?: Record<string, unknown>
  timer?: Record<string, unknown>
}

export async function stopTimer(input: Input, client: ClickUpClient): Promise<Result> {
  if (input.dryRun) {
    return { preview: { taskId: input.taskId, action: "stop" } }
  }

  const timer = await client.stopTimer(input.taskId)
  return { timer }
}
