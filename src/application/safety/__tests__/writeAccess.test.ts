import { describe, expect, it, vi } from "vitest"
import { ensureWriteAllowed } from "../writeAccess.js"
import type { ClickUpClient } from "../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../config/applicationConfig.js"

describe("ensureWriteAllowed", () => {
  const mockClient = {
    getTask: vi.fn(),
    getList: vi.fn(),
    getDocument: vi.fn()
  } as unknown as ClickUpClient

  function createConfig(mode: "write" | "read" | "selective", spaces: string[] = [], lists: string[] = []): ApplicationConfig {
    return {
      teamId: "team_1",
      apiKey: "key",
      charLimit: 1000,
      maxAttachmentMb: 10,
      writeMode: mode,
      writeAccess: {
        mode,
        allowedSpaces: new Set(spaces),
        allowedLists: new Set(lists)
      },
      hierarchyCacheTtlMs: 0,
      spaceConfigCacheTtlMs: 0,
      reportingMaxTasks: 100,
      defaultRiskWindowDays: 5
    }
  }

  it("allows everything in write mode", async () => {
    const config = createConfig("write")
    await expect(ensureWriteAllowed({ spaceId: "any" }, mockClient, config)).resolves.not.toThrow()
  })

  it("blocks everything in read mode", async () => {
    const config = createConfig("read")
    await expect(ensureWriteAllowed({ spaceId: "any" }, mockClient, config)).rejects.toThrow(/disabled in read mode/)
  })

  describe("selective mode", () => {
    it("allows explicit space access", async () => {
      const config = createConfig("selective", ["space_1"])
      await expect(ensureWriteAllowed({ spaceId: "space_1" }, mockClient, config)).resolves.not.toThrow()
    })

    it("allows explicit list access", async () => {
      const config = createConfig("selective", [], ["list_1"])
      await expect(ensureWriteAllowed({ listId: "list_1" }, mockClient, config)).resolves.not.toThrow()
    })

    it("blocks unpermitted space", async () => {
      const config = createConfig("selective", ["space_1"])
      await expect(ensureWriteAllowed({ spaceId: "space_2" }, mockClient, config)).rejects.toThrow(/limited to explicitly allowed spaces or lists/)
    })

    it("blocks unpermitted list", async () => {
      const config = createConfig("selective", [], ["list_1"])
      await expect(ensureWriteAllowed({ listId: "list_2" }, mockClient, config)).rejects.toThrow(/limited to explicitly allowed spaces or lists/)
    })

    it("allows list access if its space is allowed", async () => {
       const config = createConfig("selective", ["space_1"])

       // Mock resolving list to space
       mockClient.getList = vi.fn().mockResolvedValue({ id: "list_2", space: { id: "space_1" } })

       await expect(ensureWriteAllowed({ listId: "list_2" }, mockClient, config)).resolves.not.toThrow()
    })

    it("does not mix up list and space IDs", async () => {
      // Allowed list "123", input spaceId "123" -> should fail
      const config = createConfig("selective", [], ["123"])
      await expect(ensureWriteAllowed({ spaceId: "123" }, mockClient, config)).rejects.toThrow(/limited to explicitly allowed spaces or lists/)
    })

     it("does not mix up space and list IDs", async () => {
      // Allowed space "123", input listId "123" (which is not in that space) -> should fail (unless 123 is also a list in allowed lists)
      const config = createConfig("selective", ["123"], [])
      mockClient.getList = vi.fn().mockResolvedValue({ id: "123", space: { id: "999" } })

      await expect(ensureWriteAllowed({ listId: "123" }, mockClient, config)).rejects.toThrow(/limited to explicitly allowed spaces or lists/)
    })
  })
})
