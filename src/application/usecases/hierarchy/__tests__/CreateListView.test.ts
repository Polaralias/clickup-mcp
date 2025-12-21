import { describe, it, expect, vi } from "vitest"
import { createListView } from "../CreateListView.js"
import { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../services/HierarchyDirectory.js"

describe("createListView", () => {
  it("uses explicit filters when provided", async () => {
    const client = {
      createListView: vi.fn().mockResolvedValue({ id: "view1", url: "url" })
    } as unknown as ClickUpClient
    const directory = {} as unknown as HierarchyDirectory

    const explicitFilters = {
      op: "OR",
      fields: [],
      search: "test"
    }

    await createListView({
        listId: "123",
        name: "Test",
        filters: explicitFilters as any,
        statuses: [{ status: "ignored" }]
    }, client, directory)

    expect(client.createListView).toHaveBeenCalledWith("123", expect.objectContaining({
        filters: explicitFilters
    }))
  })

  it("falls back to legacy mapping when filters not provided", async () => {
    const client = {
        createListView: vi.fn().mockResolvedValue({ id: "view1", url: "url" })
      } as unknown as ClickUpClient
      const directory = {} as unknown as HierarchyDirectory

      await createListView({
          listId: "123",
          name: "Test",
          statuses: [{ status: "legacy" }]
      }, client, directory)

      expect(client.createListView).toHaveBeenCalledWith("123", expect.objectContaining({
          filters: { statuses: ["legacy"] }
      }))
  })
})
