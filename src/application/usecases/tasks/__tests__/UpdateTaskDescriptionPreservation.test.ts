import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { updateTask } from "../UpdateTask.js"
import { updateTasksBulk } from "../UpdateTasksBulk.js"

const config: ApplicationConfig = {
  teamId: "team-1",
  apiKey: "token",
  charLimit: 1000,
  maxAttachmentMb: 8,
  readOnly: false,
  hierarchyCacheTtlMs: 300000,
  spaceConfigCacheTtlMs: 300000,
  reportingMaxTasks: 200,
  defaultRiskWindowDays: 5
}

describe("updateTask description preservation", () => {
  it("stacks new description above the existing content", async () => {
    const getTask = vi.fn().mockResolvedValue({ task: { description: "Existing description" } })
    const update = vi.fn().mockResolvedValue({ id: "task-1" })
    const client = { getTask, updateTask: update } as unknown as ClickUpClient

    await updateTask({ taskId: "task-1", description: "New description", confirm: "yes" }, client)

    expect(getTask).toHaveBeenCalledWith("task-1")
    expect(update).toHaveBeenCalledWith("task-1", {
      description: "New description\n\n---\nPrevious description (auto preserved):\nExisting description"
    })
  })

  it("uses only the new description when no existing content", async () => {
    const getTask = vi.fn().mockResolvedValue({ task: {} })
    const update = vi.fn().mockResolvedValue({ id: "task-2" })
    const client = { getTask, updateTask: update } as unknown as ClickUpClient

    await updateTask({ taskId: "task-2", description: "Only new description", confirm: "yes" }, client)

    expect(getTask).toHaveBeenCalledWith("task-2")
    expect(update).toHaveBeenCalledWith("task-2", { description: "Only new description" })
  })
})

describe("updateTasksBulk description preservation", () => {
  it("applies preservation per task when descriptions change", async () => {
    const getTask = vi
      .fn()
      .mockResolvedValueOnce({ task: { description: "Old A" } })
      .mockResolvedValueOnce({ task: { text_content: "Old B" } })
    const update = vi.fn().mockResolvedValue({})
    const client = { getTask, updateTask: update } as unknown as ClickUpClient

    await updateTasksBulk(
      {
        tasks: [
          { taskId: "task-1", description: "New A" },
          { taskId: "task-2", description: "New B" }
        ],
        confirm: "yes"
      },
      client,
      config
    )

    expect(getTask).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith("task-1", {
      description: "New A\n\n---\nPrevious description (auto preserved):\nOld A"
    })
    expect(update).toHaveBeenCalledWith("task-2", {
      description: "New B\n\n---\nPrevious description (auto preserved):\nOld B"
    })
  })
})
