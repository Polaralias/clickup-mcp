import { describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../../services/HierarchyDirectory.js"
import { resolvePathToIds } from "../ResolvePathToIds.js"
import { resolveIdsFromPath } from "../structureShared.js"

type MethodMock<K extends keyof ClickUpClient> = ClickUpClient[K] extends (...args: any[]) => any
  ? MockInstance<ClickUpClient[K]>
  : never

type ClientStubs = {
  client: ClickUpClient
  listWorkspaces: MethodMock<"listWorkspaces">
  listSpaces: MethodMock<"listSpaces">
  listFolders: MethodMock<"listFolders">
  listLists: MethodMock<"listLists">
}

function createStubClient(): ClientStubs {
  const listWorkspaces = vi.fn<ClickUpClient["listWorkspaces"]>()
  const listSpaces = vi.fn<ClickUpClient["listSpaces"]>()
  const listFolders = vi.fn<ClickUpClient["listFolders"]>()
  const listLists = vi.fn<ClickUpClient["listLists"]>()
  const client = {
    listWorkspaces: listWorkspaces as unknown as ClickUpClient["listWorkspaces"],
    listSpaces: listSpaces as unknown as ClickUpClient["listSpaces"],
    listFolders: listFolders as unknown as ClickUpClient["listFolders"],
    listLists: listLists as unknown as ClickUpClient["listLists"],
  } as unknown as ClickUpClient
  return { client, listWorkspaces, listSpaces, listFolders, listLists }
}

describe("resolvePathToIds", () => {
  it("resolves ids from string-only hierarchy paths", async () => {
    const { client, listWorkspaces, listSpaces, listFolders, listLists } = createStubClient()
    listWorkspaces.mockResolvedValueOnce({ teams: [{ id: "ws-1", name: "Workspace" }] })
    listSpaces.mockResolvedValueOnce({ spaces: [{ id: "sp-1", name: "Space" }] })
    listFolders.mockResolvedValueOnce({ folders: [{ id: "fd-1", name: "Folder" }] })
    listLists.mockResolvedValueOnce({ lists: [{ id: "ls-1", name: "List" }] })

    const directory = new HierarchyDirectory()

    const result = await resolvePathToIds(
      { path: ["Workspace", "Space", "Folder", "List"] },
      client,
      directory,
    )

    expect(result.workspaceId).toBe("ws-1")
    expect(result.spaceId).toBe("sp-1")
    expect(result.folderId).toBe("fd-1")
    expect(result.listId).toBe("ls-1")
    expect(listWorkspaces).toHaveBeenCalledTimes(1)
    expect(listSpaces).toHaveBeenCalledTimes(1)
    expect(listFolders).toHaveBeenCalledTimes(1)
    expect(listLists).toHaveBeenCalledTimes(1)
  })
})

describe("resolveIdsFromPath", () => {
  it("normalises string segments before delegating", async () => {
    const { client, listWorkspaces, listSpaces, listFolders, listLists } = createStubClient()
    listWorkspaces.mockResolvedValueOnce({ teams: [{ id: "ws-1", name: "Workspace" }] })
    listSpaces.mockResolvedValueOnce({ spaces: [{ id: "sp-1", name: "Space" }] })
    listFolders.mockResolvedValueOnce({ folders: [] })
    listLists.mockResolvedValueOnce({ lists: [{ id: "ls-1", name: "List" }] })

    const directory = new HierarchyDirectory()

    const resolution = await resolveIdsFromPath(
      ["Workspace", "Space", { type: "list", name: "List" }],
      client,
      directory,
    )

    expect(resolution?.workspaceId).toBe("ws-1")
    expect(resolution?.spaceId).toBe("sp-1")
    expect(resolution?.listId).toBe("ls-1")
    expect(listFolders).not.toHaveBeenCalled()
  })
})
