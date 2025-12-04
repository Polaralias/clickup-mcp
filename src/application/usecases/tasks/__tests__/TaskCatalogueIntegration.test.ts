import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { TaskCatalogue } from "../../../services/TaskCatalogue.js"
import { listTasksInList } from "../ListTasksInList.js"
import { fuzzySearch } from "../FuzzySearch.js"
import { updateTask } from "../UpdateTask.js"

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

describe("TaskCatalogue integration", () => {
  let catalogue: TaskCatalogue

  beforeEach(() => {
    catalogue = new TaskCatalogue({ listTtlMs: 5_000, searchTtlMs: 5_000 })
  })

  it("reuses cached list results across repeated calls", async () => {
    const listTasksMock = vi
      .fn()
      .mockResolvedValueOnce({
        tasks: [
          {
            id: "task-1",
            name: "First",
            status: { status: "open" },
            assignees: []
          }
        ]
      })
      .mockResolvedValueOnce({ tasks: [] })

    const client = createClient({ listTasksInList: listTasksMock })
    const input = {
      listId: "list-1",
      limit: 5,
      page: 0,
      includeClosed: false,
      includeSubtasks: false,
      includeTasksInMultipleLists: true,
      assigneePreviewLimit: 3
    }

    const first = await listTasksInList(input, client, {} as ApplicationConfig, catalogue)
    const second = await listTasksInList({ ...input, limit: 10 }, client, {} as ApplicationConfig, catalogue)

    expect(listTasksMock).toHaveBeenCalledTimes(2)
    expect(first.tasks.length).toBe(1)
    expect(second.tasks.length).toBe(1)
  })

  it("reuses cached search indexes for fuzzy search", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({
      tasks: [
        {
          id: "task-1",
          name: "Example task",
          status: { status: "open" },
          list: { id: "list-1" }
        }
      ]
    })

    const client = createClient({ searchTasks: searchTasksMock })
    const config = { teamId: "team-1" } as ApplicationConfig

    await fuzzySearch({ query: "Example", limit: 5 }, client, config, catalogue)
    await fuzzySearch({ query: "Example", limit: 5 }, client, config, catalogue)

    expect(searchTasksMock).toHaveBeenCalledTimes(2)
  })

  it("fetches additional search pages when limit exceeds first page", async () => {
    const searchTasksMock = vi
      .fn()
      .mockImplementationOnce((_teamId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ search: "Example", page: 0 })
        return {
          tasks: [
            { id: "task-1", name: "Example", status: { status: "open" }, list: { id: "list-1" } },
            { id: "task-2", name: "Example two", status: { status: "open" }, list: { id: "list-1" } }
          ]
        }
      })
      .mockImplementationOnce((_teamId: string, params: Record<string, unknown>) => {
        expect(params).toMatchObject({ search: "Example", page: 1 })
        return {
          tasks: [
            { id: "task-3", name: "Example three", status: { status: "open" }, list: { id: "list-1" } }
          ]
        }
      })

    const client = createClient({ searchTasks: searchTasksMock })
    const config = { teamId: "team-1" } as ApplicationConfig

    const result = await fuzzySearch({ query: "Example", limit: 3 }, client, config, catalogue)

    expect(searchTasksMock).toHaveBeenCalledTimes(2)
    expect(result.results.length).toBe(3)
    expect(result.guidance).toBe(
      "More matches available. Increase limit or paginate through search results."
    )
  })

  it("invalidates cached search entries after task updates", async () => {
    const searchTasksMock = vi.fn().mockResolvedValue({
      tasks: [
        {
          id: "task-1",
          name: "Cached task",
          status: { status: "open" },
          list: { id: "list-1" }
        }
      ]
    })
    const updateTaskMock = vi.fn().mockResolvedValue({ id: "task-1" })

    const client = createClient({ searchTasks: searchTasksMock, updateTask: updateTaskMock })
    const config = { teamId: "team-1" } as ApplicationConfig

    await fuzzySearch({ query: "Cached", limit: 5 }, client, config, catalogue)
    expect(searchTasksMock).toHaveBeenCalledTimes(2)

    await fuzzySearch({ query: "Cached", limit: 5 }, client, config, catalogue)
    expect(searchTasksMock).toHaveBeenCalledTimes(2)

    await updateTask(
      { taskId: "task-1", name: "Updated", confirm: "yes", dryRun: false },
      client,
      catalogue
    )

    await fuzzySearch({ query: "Cached", limit: 5 }, client, config, catalogue)
    expect(searchTasksMock).toHaveBeenCalledTimes(4)
    expect(updateTaskMock).toHaveBeenCalledTimes(1)
  })
})
