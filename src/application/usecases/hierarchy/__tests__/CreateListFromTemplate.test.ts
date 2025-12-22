import { describe, it, expect, vi } from "vitest"
import { createListFromTemplate } from "../CreateListFromTemplate.js"
import { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import { HierarchyDirectory } from "../../../services/HierarchyDirectory.js"

describe("createListFromTemplate", () => {
  it("calls client with correct parameters", async () => {
    const client = {
      createListFromTemplate: vi.fn().mockResolvedValue({ id: "list123", url: "http://list" })
    } as unknown as ClickUpClient

    const directory = {
      resolvePath: vi.fn(),
      invalidateListsForFolder: vi.fn(),
      invalidateListsForSpace: vi.fn()
    } as unknown as HierarchyDirectory

    const input = {
      templateId: "temp123",
      spaceId: "space123",
      name: "New List",
      useTemplateOptions: true
    }

    const result = await createListFromTemplate(input, client, directory)

    expect(client.createListFromTemplate).toHaveBeenCalledWith(
      "temp123",
      { spaceId: "space123", folderId: undefined },
      { name: "New List", use_template_options: true }
    )
    expect(result.list).toBeDefined()
    expect(result.list?.id).toBe("list123")
  })

  it("handles dry run", async () => {
    const client = {} as unknown as ClickUpClient
    const directory = {} as unknown as HierarchyDirectory

    const input = {
      templateId: "temp123",
      spaceId: "space123",
      name: "New List",
      dryRun: true
    }

    const result = await createListFromTemplate(input, client, directory)

    expect(result.preview).toBeDefined()
    expect(result.preview?.action).toBe("createFromTemplate")
    expect(result.list).toBeUndefined()
  })
})
