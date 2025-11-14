import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { listTasksInList } from "../ListTasksInList.js"

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

function buildTasks(count: number, offset = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `task-${offset + index + 1}`,
    name: `Task ${offset + index + 1}`,
    status: { status: "open" },
    assignees: [],
    list: { id: "list-1", name: "Example list", url: "https://app.clickup.com/l/list-1" }
  }))
}

describe("listTasksInList pagination", () => {
  const baseInput = {
    listId: "list-1",
    limit: 120,
    page: 0,
    includeClosed: false,
    includeSubtasks: false,
    assigneePreviewLimit: 3
  }

  const config = {} as ApplicationConfig

  it("continues fetching pages until limit is satisfied", async () => {
    const listTasksMock = vi
      .fn()
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 0, page_size: 100 })
        return { tasks: buildTasks(100) }
      })
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 1, page_size: 100 })
        return { tasks: buildTasks(15, 100) }
      })
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 2, page_size: 100 })
        return { tasks: [] }
      })

    const client = createClient({ listTasksInList: listTasksMock })

    const result = await listTasksInList(baseInput, client, config)

    expect(listTasksMock).toHaveBeenCalledTimes(3)
    expect(result.tasks.length).toBe(115)
    expect(result.total).toBe(115)
    expect(result.truncated).toBe(false)
    expect(result.guidance).toBeUndefined()
  })

  it("marks results as truncated when collected pages exceed limit", async () => {
    const listTasksMock = vi
      .fn()
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 0, page_size: 100 })
        return { tasks: buildTasks(100) }
      })
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 1, page_size: 100 })
        return { tasks: buildTasks(80, 100) }
      })

    const client = createClient({ listTasksInList: listTasksMock })

    const result = await listTasksInList(baseInput, client, config)

    expect(listTasksMock).toHaveBeenCalledTimes(2)
    expect(result.tasks.length).toBe(120)
    expect(result.total).toBe(180)
    expect(result.truncated).toBe(true)
    expect(result.guidance).toBe(
      "Task list truncated for token safety. Increase limit or paginate with page to see more results."
    )
  })

  it("requests page sizes aligned with the limit when below the ClickUp cap", async () => {
    const smallLimitInput = { ...baseInput, limit: 15 }
    const listTasksMock = vi
      .fn()
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 0, page_size: 15 })
        return { tasks: buildTasks(15) }
      })
      .mockImplementationOnce((_listId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ page: 1, page_size: 15 })
        return { tasks: [] }
      })

    const client = createClient({ listTasksInList: listTasksMock })

    const result = await listTasksInList(smallLimitInput, client, config)

    expect(listTasksMock).toHaveBeenCalledTimes(2)
    expect(result.tasks.length).toBe(15)
    expect(result.truncated).toBe(false)
  })
})
