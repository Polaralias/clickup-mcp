import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { HierarchyDirectory } from "../../../services/HierarchyDirectory.js"
import { taskStatusReport } from "../TaskStatusReport.js"
import { taskRiskReport } from "../TaskRiskReport.js"

const config: ApplicationConfig = {
  teamId: "team-1",
  apiKey: "token",
  charLimit: 10000,
  maxAttachmentMb: 8,
  readOnly: false,
  writeAccess: { mode: "read_write", allowedSpaces: new Set(), allowedLists: new Set() },
  hierarchyCacheTtlMs: 300000,
  spaceConfigCacheTtlMs: 300000,
  reportingMaxTasks: 10,
  defaultRiskWindowDays: 7
}

const directory = new HierarchyDirectory()

describe("task reporting include_timl defaults", () => {
  it("requests tasks in multiple lists by default for status reports", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

      await taskStatusReport(
        { workspaceId: "ws-1", includeTasksInMultipleLists: true, includeSubtasks: true },
        client,
        config,
        directory
      )

    expect(searchTasksMock).toHaveBeenCalled()
    expect(searchTasksMock.mock.calls[0]?.[1]?.include_timl).toBe(true)
    expect(searchTasksMock.mock.calls[0]?.[1]?.subtasks).toBe(true)
  })

  it("omits include_timl when disabled for status reports", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    await taskStatusReport(
        { workspaceId: "ws-1", includeTasksInMultipleLists: false, includeSubtasks: true },
        client,
        config,
        directory
      )

    expect(searchTasksMock.mock.calls[0]?.[1]?.include_timl).toBeUndefined()
    expect(searchTasksMock.mock.calls[0]?.[1]?.subtasks).toBe(true)
  })

  it("propagates include_timl default for risk reports", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

      await taskRiskReport(
        { workspaceId: "ws-1", includeTasksInMultipleLists: true, includeSubtasks: true },
        client,
        config,
        directory
      )

    expect(searchTasksMock).toHaveBeenCalled()
    expect(searchTasksMock.mock.calls[0]?.[1]?.include_timl).toBe(true)
    expect(searchTasksMock.mock.calls[0]?.[1]?.subtasks).toBe(true)
  })

  it("omits include_timl when disabled for risk reports", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    await taskRiskReport(
      { workspaceId: "ws-1", includeTasksInMultipleLists: false, includeSubtasks: false },
      client,
      config,
      directory
    )

    expect(searchTasksMock.mock.calls[0]?.[1]?.include_timl).toBeUndefined()
    expect(searchTasksMock.mock.calls[0]?.[1]?.subtasks).toBeUndefined()
  })
})
