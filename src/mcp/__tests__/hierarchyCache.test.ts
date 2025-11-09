import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HierarchyDirectory } from "../../application/services/HierarchyDirectory.js"
import { listWorkspaces } from "../../application/usecases/hierarchy/ListWorkspaces.js"
import { listSpaces } from "../../application/usecases/hierarchy/ListSpaces.js"
import { listLists } from "../../application/usecases/hierarchy/ListLists.js"
import { createList } from "../../application/usecases/hierarchy/CreateList.js"
import type { ClickUpClient } from "../../infrastructure/clickup/ClickUpClient.js"

function createClient(overrides: Partial<ClickUpClient>): ClickUpClient {
  return overrides as unknown as ClickUpClient
}

describe("HierarchyDirectory caching", () => {
  let directory: HierarchyDirectory

  beforeEach(() => {
    directory = new HierarchyDirectory(100)
  })

  it("reuses cached workspaces within the TTL", async () => {
    const client = createClient({
      listWorkspaces: vi
        .fn()
        .mockResolvedValue({ teams: [{ id: "team-1", name: "Team One" }] })
    })

    await listWorkspaces(client, directory)
    await listWorkspaces(client, directory)

    expect((client.listWorkspaces as any).mock.calls.length).toBe(1)
  })

  it("refreshes cached spaces after the TTL expires", async () => {
    vi.useFakeTimers()

    const client = createClient({
      listSpaces: vi.fn().mockResolvedValue({ spaces: [{ id: "space-1" }] })
    })

    await listSpaces({ workspaceId: "workspace-1" }, client, directory)
    await listSpaces({ workspaceId: "workspace-1" }, client, directory)
    expect((client.listSpaces as any).mock.calls.length).toBe(1)

    vi.advanceTimersByTime(200)

    await listSpaces({ workspaceId: "workspace-1" }, client, directory)
    expect((client.listSpaces as any).mock.calls.length).toBe(2)

    vi.useRealTimers()
  })

  it("invalidates list caches after createList mutations", async () => {
    const listListsMock = vi
      .fn()
      .mockResolvedValue({ lists: [{ id: "list-1", name: "List One" }] })

    const createListMock = vi.fn().mockResolvedValue({ id: "list-2", name: "List Two" })

    const client = createClient({
      listLists: listListsMock,
      createListInSpace: createListMock
    })

    await listLists({ spaceId: "space-1" }, client, directory)
    await listLists({ spaceId: "space-1" }, client, directory)
    expect(listListsMock).toHaveBeenCalledTimes(1)

    await createList(
      {
        spaceId: "space-1",
        name: "New List",
        statuses: [],
        confirm: "yes"
      },
      client,
      directory
    )

    await listLists({ spaceId: "space-1" }, client, directory)
    expect(listListsMock).toHaveBeenCalledTimes(2)
    expect(createListMock).toHaveBeenCalledTimes(1)
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
