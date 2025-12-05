import { describe, expect, it, vi } from "vitest"
import { searchTasks } from "../SearchTasks.js"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"

describe("searchTasks status normalisation", () => {
  const config: ApplicationConfig = {
    teamId: "team-1",
    apiKey: "token",
    charLimit: 1000,
    maxAttachmentMb: 8,
    readOnly: false,
    hierarchyCacheTtlMs: 300000,
    spaceConfigCacheTtlMs: 300000,
    reportingMaxTasks: 200,
    defaultRiskWindowDays: 5
  }

  it("coerces a single status into statuses[]", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

      await searchTasks(
        { page: 0, pageSize: 20, status: "Open", includeTasksInMultipleLists: true, includeSubtasks: true },
        client,
        config
      )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ statuses: ["Open"] })
    )
  })

  it("passes through provided statuses arrays", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({ tasks: [] })
    const client = { searchTasks: searchTasksMock } as unknown as ClickUpClient

    await searchTasks(
        {
          page: 0,
          pageSize: 20,
          statuses: ["Open", "Closed"],
          includeTasksInMultipleLists: true,
          includeSubtasks: true
        },
        client,
        config
      )

    expect(searchTasksMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ statuses: ["Open", "Closed"] })
    )
  })
})
