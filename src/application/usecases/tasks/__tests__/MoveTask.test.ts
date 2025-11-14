import { afterEach, describe, expect, it, vi } from "vitest"

import { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { moveTask } from "../MoveTask.js"

describe("moveTask", () => {
  const client = new ClickUpClient("token")

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("invalidates caches after a verified move", async () => {
    const moveSpy = vi.spyOn(client, "moveTask").mockResolvedValue({})
    const getTaskSpy = vi.spyOn(client, "getTask").mockResolvedValue({
      id: "task-123",
      list_id: "list-456"
    })
    const catalogue = {
      invalidateTask: vi.fn(),
      invalidateList: vi.fn(),
      invalidateSearch: vi.fn()
    }

    const result = await moveTask(
      { confirm: "yes", dryRun: false, taskId: "task-123", listId: "list-456" },
      client,
      catalogue
    )

    expect(result.status).toBe("moved")
    expect(moveSpy).toHaveBeenCalledWith("task-123", "list-456")
    expect(getTaskSpy).toHaveBeenCalledWith("task-123")
    expect(catalogue.invalidateTask).toHaveBeenCalledWith("task-123")
    expect(catalogue.invalidateList).toHaveBeenCalledWith("list-456")
    expect(catalogue.invalidateSearch).toHaveBeenCalledTimes(1)
  })

  it("throws when the verification disagrees and skips cache invalidation", async () => {
    vi.spyOn(client, "moveTask").mockResolvedValue({})
    vi.spyOn(client, "getTask").mockResolvedValue({
      id: "task-123",
      list_id: "list-789"
    })
    const catalogue = {
      invalidateTask: vi.fn(),
      invalidateList: vi.fn(),
      invalidateSearch: vi.fn()
    }

    await expect(
      moveTask({ confirm: "yes", dryRun: false, taskId: "task-123", listId: "list-456" }, client, catalogue)
    ).rejects.toThrow(/Post-move verification failed/)
    expect(catalogue.invalidateTask).not.toHaveBeenCalled()
    expect(catalogue.invalidateList).not.toHaveBeenCalled()
    expect(catalogue.invalidateSearch).not.toHaveBeenCalled()
  })
})
