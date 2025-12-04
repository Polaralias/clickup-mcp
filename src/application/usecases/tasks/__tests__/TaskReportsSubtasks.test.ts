import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../../services/HierarchyDirectory.js"
import { taskRiskReport } from "../TaskRiskReport.js"
import { taskStatusReport } from "../TaskStatusReport.js"

describe("task reports subtasks", () => {
  const config = {
    teamId: "team-1",
    reportingMaxTasks: 5,
    charLimit: 10000,
    defaultRiskWindowDays: 7
  } as any

  it("includes subtasks in status report queries and samples", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [{ id: "task-1", parent: "parent-1" }] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    const result = await taskStatusReport(
      { workspaceId: "ws-1", includeSubtasks: true },
      client,
      config,
      new HierarchyDirectory()
    )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ subtasks: true })
    )
    expect(result.samples.byStatus[0].samples[0].isSubtask).toBe(true)
    expect(result.scopeNote.toLowerCase()).toContain("subtasks")
  })

  it("respects includeSubtasks=false for risk report queries", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    const result = await taskRiskReport(
      { workspaceId: "ws-1", includeSubtasks: false },
      client,
      config,
      new HierarchyDirectory()
    )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ subtasks: false })
    )
    expect(result.scopeNote.toLowerCase()).toContain("excluded")
  })
})
