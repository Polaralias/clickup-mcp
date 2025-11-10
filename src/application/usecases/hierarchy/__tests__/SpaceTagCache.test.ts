import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { SpaceTagCache } from "../../../services/SpaceTagCache.js"
import { listTagsForSpace } from "../ListTagsForSpace.js"
import { loadSpaceTags } from "../tagShared.js"
import { createSpaceTag } from "../CreateSpaceTag.js"
import { updateSpaceTag } from "../UpdateSpaceTag.js"
import { deleteSpaceTag } from "../DeleteSpaceTag.js"

type ClientStubs = {
  client: ClickUpClient
  listTagsForSpace: ReturnType<typeof vi.fn>
  createSpaceTag: ReturnType<typeof vi.fn>
  updateSpaceTag: ReturnType<typeof vi.fn>
  deleteSpaceTag: ReturnType<typeof vi.fn>
}

function createStubClient(): ClientStubs {
  const listTagsForSpace = vi.fn<Parameters<ClickUpClient["listTagsForSpace"]>, Promise<unknown>>()
  const createSpaceTag = vi.fn<Parameters<ClickUpClient["createSpaceTag"]>, Promise<unknown>>()
  const updateSpaceTag = vi.fn<Parameters<ClickUpClient["updateSpaceTag"]>, Promise<unknown>>()
  const deleteSpaceTag = vi.fn<Parameters<ClickUpClient["deleteSpaceTag"]>, Promise<unknown>>()
  const client = {
    listTagsForSpace,
    createSpaceTag,
    updateSpaceTag,
    deleteSpaceTag
  } as unknown as ClickUpClient
  return { client, listTagsForSpace, createSpaceTag, updateSpaceTag, deleteSpaceTag }
}

describe("SpaceTagCache integration", () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it("reuses cached space tags for repeated reads", async () => {
    const { client, listTagsForSpace: listStub } = createStubClient()
    listStub.mockResolvedValueOnce({ tags: [{ name: "Alpha" }] })
    const cache = new SpaceTagCache()

    const first = await listTagsForSpace({ spaceId: "space-1" }, client, cache)
    const firstTags = first.tags as Array<{ name: string }>
    expect(firstTags).toEqual([{ name: "Alpha" }])

    const second = await listTagsForSpace({ spaceId: "space-1" }, client, cache)
    const secondTags = second.tags as Array<{ name: string }>
    expect(secondTags).toEqual([{ name: "Alpha" }])
    expect(listStub).toHaveBeenCalledTimes(1)
  })

  it("fetches new space tags after the TTL expires", async () => {
    vi.useFakeTimers()
    const { client, listTagsForSpace: listStub } = createStubClient()
    listStub.mockResolvedValueOnce({ tags: [{ name: "Alpha" }] })
    listStub.mockResolvedValueOnce({ tags: [{ name: "Beta" }] })
    const cache = new SpaceTagCache(1000)

    const first = await listTagsForSpace({ spaceId: "space-1" }, client, cache)
    const firstTags = first.tags as Array<{ name: string }>
    expect(firstTags[0]).toEqual({ name: "Alpha" })

    vi.advanceTimersByTime(500)
    const second = await listTagsForSpace({ spaceId: "space-1" }, client, cache)
    const secondTags = second.tags as Array<{ name: string }>
    expect(secondTags[0]).toEqual({ name: "Alpha" })

    vi.advanceTimersByTime(600)
    const third = await listTagsForSpace({ spaceId: "space-1", forceRefresh: false }, client, cache)
    const thirdTags = third.tags as Array<{ name: string }>
    expect(thirdTags[0]).toEqual({ name: "Beta" })
    expect(listStub).toHaveBeenCalledTimes(2)
  })

  it("invalidates cached tags after creating a tag", async () => {
    const { client, listTagsForSpace: listStub, createSpaceTag: createStub } = createStubClient()
    const cache = new SpaceTagCache()

    listStub.mockResolvedValueOnce({ tags: [{ name: "Existing" }] })
    const existing = await loadSpaceTags("space-1", client, cache)
    expect(existing.map((tag) => tag.name)).toEqual(["Existing"])
    expect(listStub).toHaveBeenCalledTimes(1)

    createStub.mockResolvedValue({ tag: { name: "New" } })
    await createSpaceTag({ spaceId: "space-1", name: "New" }, client, cache)
    expect(createStub).toHaveBeenCalledWith("space-1", { tag: "New" })

    listStub.mockResolvedValueOnce({ tags: [{ name: "Existing" }, { name: "New" }] })
    const refreshed = await loadSpaceTags("space-1", client, cache)
    expect(listStub).toHaveBeenCalledTimes(2)
    expect(refreshed.map((tag) => tag.name)).toEqual(["Existing", "New"])
  })

  it("invalidates cached tags after updating a tag", async () => {
    const { client, listTagsForSpace: listStub, updateSpaceTag: updateStub } = createStubClient()
    const cache = new SpaceTagCache()

    listStub.mockResolvedValueOnce({ tags: [{ name: "Alpha", tag_fg: "#111111" }] })
    const existing = await loadSpaceTags("space-1", client, cache)
    expect(existing[0]?.name).toBe("Alpha")
    expect(listStub).toHaveBeenCalledTimes(1)

    updateStub.mockResolvedValue({ tag: { name: "Beta", tag_fg: "#222222" } })
    await updateSpaceTag(
      { spaceId: "space-1", currentName: "Alpha", name: "Beta" },
      client,
      cache
    )
    expect(updateStub).toHaveBeenCalledWith("space-1", "Alpha", { tag: "Beta" })

    listStub.mockResolvedValueOnce({ tags: [{ name: "Beta", tag_fg: "#222222" }] })
    const refreshed = await loadSpaceTags("space-1", client, cache)
    expect(listStub).toHaveBeenCalledTimes(2)
    expect(refreshed[0]?.name).toBe("Beta")
  })

  it("invalidates cached tags after deleting a tag", async () => {
    const { client, listTagsForSpace: listStub, deleteSpaceTag: deleteStub } = createStubClient()
    const cache = new SpaceTagCache()

    listStub.mockResolvedValueOnce({ tags: [{ name: "RemoveMe" }] })
    const existing = await loadSpaceTags("space-1", client, cache)
    expect(existing[0]?.name).toBe("RemoveMe")
    expect(listStub).toHaveBeenCalledTimes(1)

    deleteStub.mockResolvedValue(undefined)
    await deleteSpaceTag({ spaceId: "space-1", name: "RemoveMe" }, client, cache)
    expect(deleteStub).toHaveBeenCalledWith("space-1", "RemoveMe")

    listStub.mockResolvedValueOnce({ tags: [] })
    const refreshed = await loadSpaceTags("space-1", client, cache)
    expect(listStub).toHaveBeenCalledTimes(2)
    expect(refreshed).toEqual([])
  })
})
