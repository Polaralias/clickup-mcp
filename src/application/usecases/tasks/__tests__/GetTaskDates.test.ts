import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { getTask } from "../GetTask.js"

const config: ApplicationConfig = {
  teamId: "team-1",
  apiKey: "token",
  charLimit: 1000,
  maxAttachmentMb: 8,
  writeMode: "write",
  writeAccess: { mode: "write", allowedSpaces: new Set(), allowedLists: new Set() },
  hierarchyCacheTtlMs: 300000,
  spaceConfigCacheTtlMs: 300000,
  reportingMaxTasks: 200,
  defaultRiskWindowDays: 5
}

describe("getTask date mapping", () => {
  it("exposes createdDate and updatedDate when provided", async () => {
    const created = 1_700_000_000_000
    const updated = created + 10_000
    const getTaskMock = vi.fn().mockResolvedValue({
      task: {
        id: "task-1",
        name: "Example",
        date_created: created,
        date_updated: updated,
        assignees: [],
        tags: [],
        watchers: [],
        checklists: []
      }
    })

    const client = { getTask: getTaskMock } as unknown as ClickUpClient

    const result = await getTask({ taskId: "task-1", detailLimit: 10 }, client, config)

    expect(result.task.createdDate).toBe(new Date(created).toISOString())
    expect(result.task.updatedDate).toBe(new Date(updated).toISOString())
  })
})
