import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { getTask } from "../GetTask.js"

const config: ApplicationConfig = {
  teamId: "team-1",
  apiKey: "token",
  charLimit: 1000,
  maxAttachmentMb: 8,
  readOnly: false,
  writeAccess: { mode: "read_write", allowedSpaces: new Set(), allowedLists: new Set() },
  hierarchyCacheTtlMs: 300000,
  spaceConfigCacheTtlMs: 300000,
  reportingMaxTasks: 200,
  defaultRiskWindowDays: 5
}

describe("getTask subtasks", () => {
  it("requests subtasks and surfaces hierarchy metadata", async () => {
    const getTaskMock = vi.fn().mockResolvedValue({
      task: {
        id: "task-1",
        name: "Parent task",
        parent: "parent-1",
        subtasks: [{ id: "child-1" }, { id: "child-2" }],
        assignees: [],
        tags: [],
        watchers: [],
        checklists: []
      }
    })

    const client = { getTask: getTaskMock } as unknown as ClickUpClient

      const result = await getTask({ taskId: "task-1", detailLimit: 10 }, client, config)

    expect(getTaskMock).toHaveBeenCalledWith("task-1", { subtasks: true })
    expect(result.task.parentId).toBe("parent-1")
    expect(result.task.isSubtask).toBe(true)
    expect(result.task.hasSubtasks).toBe(true)
    expect(result.task.subtaskCount).toBe(2)
  })

  it("defaults subtask metadata when absent", async () => {
    const getTaskMock = vi.fn().mockResolvedValue({
      task: {
        id: "task-2",
        name: "Standalone",
        assignees: [],
        tags: [],
        watchers: [],
        checklists: []
      }
    })

    const client = { getTask: getTaskMock } as unknown as ClickUpClient

      const result = await getTask({ taskId: "task-2", detailLimit: 10 }, client, config)

    expect(result.task.parentId).toBeUndefined()
    expect(result.task.isSubtask).toBe(false)
    expect(result.task.hasSubtasks).toBe(false)
    expect(result.task.subtaskCount).toBe(0)
  })
})

