import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { getTask } from "../GetTask.js"

describe("getTask subtasks", () => {
  const config = {} as ApplicationConfig

  it("requests subtasks and surfaces hierarchy metadata", async () => {
    const getTaskMock = vi.fn().mockResolvedValue({
      id: "task-1",
      name: "Parent task",
      parent: "parent-123",
      subtasks: [{ id: "child-1" }]
    })
    const client = { getTask: getTaskMock } as unknown as ClickUpClient

    const result = await getTask({ taskId: "task-1", detailLimit: 5 }, client, config)

    expect(getTaskMock).toHaveBeenCalledWith("task-1", { subtasks: true })
    expect(result.task.parentId).toBe("parent-123")
    expect(result.task.hasSubtasks).toBe(true)
    expect(result.task.subtaskCount).toBe(1)
  })

  it("defaults subtask metadata when ClickUp omits children", async () => {
    const getTaskMock = vi.fn().mockResolvedValue({ id: "task-2", name: "Leaf" })
    const client = { getTask: getTaskMock } as unknown as ClickUpClient

    const result = await getTask({ taskId: "task-2", detailLimit: 5 }, client, config)

    expect(result.task.hasSubtasks).toBe(false)
    expect(result.task.subtaskCount).toBe(0)
  })
})
