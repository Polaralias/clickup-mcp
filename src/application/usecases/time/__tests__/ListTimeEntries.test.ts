import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { listTimeEntries } from "../ListTimeEntries.js"

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

describe("listTimeEntries", () => {
  const config = { teamId: "team-1" } as ApplicationConfig
  const baseInput = { page: 0, pageSize: 20 }

  it("normalises ISO strings and epoch seconds to epoch milliseconds", async () => {
    const isoFrom = "2024-01-01T00:00:00Z"
    const secondsTo = 1_700_086_400
    const expectedFrom = Date.parse(isoFrom)
    const expectedTo = secondsTo * 1000

    const listTimeEntriesMock = vi.fn().mockResolvedValue({ data: [] })
    const client = createClient({ listTimeEntries: listTimeEntriesMock })

    await listTimeEntries({ ...baseInput, from: isoFrom, to: secondsTo }, client, config)

    expect(listTimeEntriesMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({
        page: 0,
        include_task_details: true,
        start_date: expectedFrom,
        end_date: expectedTo
      })
    )
  })

  it("passes epoch millisecond values through unchanged", async () => {
    const from = 1_700_000_000_123
    const to = 1_700_086_400_456

    const listTimeEntriesMock = vi.fn().mockResolvedValue({ data: [] })
    const client = createClient({ listTimeEntries: listTimeEntriesMock })

    await listTimeEntries({ ...baseInput, from, to }, client, config)

    expect(listTimeEntriesMock).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({
        start_date: from,
        end_date: to
      })
    )
  })
})
