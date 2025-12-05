import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import * as CreateTaskModule from "../CreateTask.js"
import { createSubtasksBulk } from "../CreateSubtasksBulk.js"

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

describe("createSubtasksBulk", () => {
  it("propagates default parentTaskId when missing per entry", async () => {
    const createTaskSpy = vi.spyOn(CreateTaskModule, "createTask").mockResolvedValue({ task: { id: "task-1" } })
    const client = {} as ClickUpClient

    await createSubtasksBulk(
      {
        defaults: { listId: "list-1", parentTaskId: "parent-1" },
        subtasks: [{ name: "child A" }]
      },
      client,
      config
    )

    expect(createTaskSpy).toHaveBeenCalled()
    expect(createTaskSpy.mock.calls[0]?.[0]?.parentTaskId).toBe("parent-1")
    expect(createTaskSpy.mock.calls[0]?.[0]?.listId).toBe("list-1")
  })

  it("uses per-entry parentTaskId when provided", async () => {
    const createTaskSpy = vi.spyOn(CreateTaskModule, "createTask").mockResolvedValue({ task: { id: "task-2" } })
    const client = {} as ClickUpClient

    await createSubtasksBulk(
      {
        defaults: { listId: "list-1", parentTaskId: "parent-default" },
        subtasks: [
          { name: "child B", parentTaskId: "parent-override", listId: "list-2" },
          { name: "child C" }
        ]
      },
      client,
      config
    )

    expect(createTaskSpy).toHaveBeenCalledTimes(2)
    expect(createTaskSpy.mock.calls[0]?.[0]?.parentTaskId).toBe("parent-override")
    expect(createTaskSpy.mock.calls[0]?.[0]?.listId).toBe("list-2")
    expect(createTaskSpy.mock.calls[1]?.[0]?.parentTaskId).toBe("parent-default")
  })
})

