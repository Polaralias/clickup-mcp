import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { listTasksInList } from "../ListTasksInList.js"

describe("listTasksInList hierarchy signals", () => {
  const config = {} as ApplicationConfig
  const baseInput = {
    listId: "list-1",
    limit: 10,
    page: 0,
    includeClosed: false,
    includeSubtasks: true,
    includeTasksInMultipleLists: false,
    assigneePreviewLimit: 3
  }

  it("marks subtasks and parent metadata", async () => {
    const client = {
      listTasksInList: vi.fn().mockResolvedValue({
        tasks: [
          { id: "task-1", parent: "parent-1" },
          { id: "task-2", subtasks: [{ id: "child" }] }
        ]
      })
    } as unknown as ClickUpClient

    const result = await listTasksInList(baseInput, client, config)

    expect(result.tasks[0]).toMatchObject({ isSubtask: true, parentId: "parent-1", hasSubtasks: false, subtaskCount: 0 })
    expect(result.tasks[1]).toMatchObject({ isSubtask: false, hasSubtasks: true, subtaskCount: 1 })
  })

  it("passes subtasks flag when includeSubtasks is true", async () => {
    const listTasksInListMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { listTasksInList: listTasksInListMock } as unknown as ClickUpClient

    await listTasksInList(baseInput, client, config)

    expect(listTasksInListMock).toHaveBeenCalledWith(
      "list-1",
      expect.objectContaining({ subtasks: true })
    )
  })
})
