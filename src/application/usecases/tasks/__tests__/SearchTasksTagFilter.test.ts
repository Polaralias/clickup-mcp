import { describe, expect, it, vi } from "vitest"
import { searchTasks } from "../SearchTasks.js"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"

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

describe("searchTasks tag filters", () => {
  it("passes tag arrays through to ClickUp", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

      await searchTasks(
        { page: 0, pageSize: 10, tagIds: ["one", "two"], includeTasksInMultipleLists: true, includeSubtasks: true },
        client,
        config
      )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ tags: ["one", "two"], include_timl: true })
    )
  })

  it("omits include_timl when explicitly disabled", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    await searchTasks(
        {
          page: 0,
          pageSize: 10,
          tagIds: ["alpha"],
          includeTasksInMultipleLists: false,
          includeSubtasks: true
        },
        client,
        config
      )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ tags: ["alpha"] })
    )
    expect(searchTasksMock.mock.calls[0]?.[1]?.include_timl).toBeUndefined()
  })
})
