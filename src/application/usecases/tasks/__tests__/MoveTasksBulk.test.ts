import { afterEach, describe, expect, it, vi } from "vitest"

import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { moveTasksBulk } from "../MoveTasksBulk.js"

describe("moveTasksBulk", () => {
  const client = new ClickUpClient("token")
  const config: ApplicationConfig = {
    teamId: "team-1",
    apiKey: "token",
    charLimit: 10_000,
    maxAttachmentMb: 8
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("surfaces per-task results including failures", async () => {
    vi.spyOn(client, "moveTasksBulk").mockResolvedValue([
      { success: true, taskId: "task-123", listId: "list-123" },
      { success: false, taskId: "task-456", listId: "list-123", error: { message: "ClickUp 500: boom" } }
    ])
    const getTaskSpy = vi.spyOn(client, "getTask").mockResolvedValue({
      id: "task-123",
      list_id: "list-123"
    })

    const catalogue = {
      invalidateTask: vi.fn(),
      invalidateList: vi.fn(),
      invalidateSearch: vi.fn()
    }

    const result = await moveTasksBulk(
      {
        confirm: "yes",
        dryRun: false,
        defaults: { listId: "list-123" },
        tasks: [{ taskId: "task-123" }, { taskId: "task-456" }]
      },
      client,
      config,
      catalogue
    )

    expect(getTaskSpy).toHaveBeenCalledTimes(1)
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failedIndices).toEqual([1])
    expect(result.results[0]).toMatchObject({
      index: 0,
      taskId: "task-123",
      listId: "list-123",
      status: "moved"
    })
    expect(result.results[1]).toMatchObject({
      index: 1,
      taskId: "task-456",
      listId: "list-123",
      status: "failed",
      error: {
        message: "ClickUp 500: boom"
      }
    })
    expect(catalogue.invalidateTask).toHaveBeenCalledTimes(1)
    expect(catalogue.invalidateTask).toHaveBeenCalledWith("task-123")
    expect(catalogue.invalidateList).toHaveBeenCalledTimes(1)
    expect(catalogue.invalidateList).toHaveBeenCalledWith("list-123")
    expect(catalogue.invalidateSearch).toHaveBeenCalledTimes(1)
  })

  it("marks entries as failed when verification disagrees and skips invalidation", async () => {
    vi.spyOn(client, "moveTasksBulk").mockResolvedValue([
      { success: true, taskId: "task-123", listId: "list-123" },
      { success: true, taskId: "task-456", listId: "list-123" }
    ])
    const getTaskSpy = vi.spyOn(client, "getTask")
    getTaskSpy
      .mockResolvedValueOnce({ id: "task-123", list_id: "list-123" })
      .mockResolvedValueOnce({ id: "task-456", list_id: "list-999" })

    const catalogue = {
      invalidateTask: vi.fn(),
      invalidateList: vi.fn(),
      invalidateSearch: vi.fn()
    }

    const result = await moveTasksBulk(
      {
        confirm: "yes",
        dryRun: false,
        defaults: { listId: "list-123" },
        tasks: [{ taskId: "task-123" }, { taskId: "task-456" }]
      },
      client,
      config,
      catalogue
    )

    expect(getTaskSpy).toHaveBeenCalledTimes(2)
    expect(result.total).toBe(2)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.failedIndices).toEqual([1])
    expect(result.results[1]).toMatchObject({
      index: 1,
      taskId: "task-456",
      listId: "list-123",
      status: "failed",
      error: {
        message: expect.stringContaining("Post-move verification failed")
      }
    })
    expect(catalogue.invalidateTask).toHaveBeenCalledTimes(1)
    expect(catalogue.invalidateTask).toHaveBeenCalledWith("task-123")
    expect(catalogue.invalidateList).toHaveBeenCalledTimes(1)
    expect(catalogue.invalidateList).toHaveBeenCalledWith("list-123")
    expect(catalogue.invalidateSearch).toHaveBeenCalledTimes(1)
  })

  it("skips all cache invalidation when no move is verified", async () => {
    vi.spyOn(client, "moveTasksBulk").mockResolvedValue([
      { success: true, taskId: "task-123", listId: "list-123" }
    ])
    const getTaskSpy = vi.spyOn(client, "getTask").mockResolvedValue({
      id: "task-123",
      list_id: "list-999"
    })

    const catalogue = {
      invalidateTask: vi.fn(),
      invalidateList: vi.fn(),
      invalidateSearch: vi.fn()
    }

    const result = await moveTasksBulk(
      {
        confirm: "yes",
        dryRun: false,
        defaults: { listId: "list-123" },
        tasks: [{ taskId: "task-123" }]
      },
      client,
      config,
      catalogue
    )

    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(result.results[0]).toMatchObject({
      index: 0,
      taskId: "task-123",
      listId: "list-123",
      status: "failed"
    })
    expect(getTaskSpy).toHaveBeenCalledTimes(1)
    expect(catalogue.invalidateTask).not.toHaveBeenCalled()
    expect(catalogue.invalidateList).not.toHaveBeenCalled()
    expect(catalogue.invalidateSearch).not.toHaveBeenCalled()
  })
})
