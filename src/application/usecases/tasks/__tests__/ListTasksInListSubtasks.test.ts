import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { listTasksInList } from "../ListTasksInList.js"

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

describe("listTasksInList subtasks", () => {
  it("includes subtasks flag by default and maps hierarchy fields", async () => {
    const listTasksInListMock = vi.fn().mockResolvedValue({
      tasks: [
        { id: "parent-1", name: "Parent", subtasks: [{ id: "child" }] },
        { id: "child", name: "Child", parent: "parent-1" }
      ]
    })
    const client = { listTasksInList: listTasksInListMock } as unknown as ClickUpClient

    const result = await listTasksInList(
      {
        listId: "list-1",
        limit: 10,
        page: 0,
        includeClosed: false,
        includeSubtasks: true,
        includeTasksInMultipleLists: true,
        assigneePreviewLimit: 5
      },
      client,
      config
    )

    expect(listTasksInListMock).toHaveBeenCalled()
    expect(listTasksInListMock.mock.calls[0]?.[1]?.subtasks).toBe(true)
    const [parent, child] = result.tasks
    expect(parent?.hasSubtasks).toBe(true)
    expect(parent?.subtaskCount).toBe(1)
    expect(parent?.isSubtask).toBe(false)
    expect(child?.isSubtask).toBe(true)
    expect(child?.parentId).toBe("parent-1")
  })

  it("omits subtasks flag when explicitly disabled", async () => {
    const listTasksInListMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { listTasksInList: listTasksInListMock } as unknown as ClickUpClient

    await listTasksInList(
      {
        listId: "list-1",
        limit: 5,
        page: 0,
        includeClosed: false,
        includeSubtasks: false,
        includeTasksInMultipleLists: true,
        assigneePreviewLimit: 3
      },
      client,
      config
    )

    expect(listTasksInListMock.mock.calls[0]?.[1]?.subtasks).toBeUndefined()
  })
})

