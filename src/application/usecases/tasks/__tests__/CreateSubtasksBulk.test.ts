import { describe, expect, it, vi } from "vitest"
import type { ClickUpClient } from "../../../../infrastructure/clickup/ClickUpClient.js"
import type { ApplicationConfig } from "../../../config/applicationConfig.js"
import { createSubtasksBulk } from "../CreateSubtasksBulk.js"
import { createTask } from "../CreateTask.js"

vi.mock("../CreateTask.js", () => ({
  createTask: vi.fn().mockResolvedValue({ task: { id: "created" } })
}))

describe("createSubtasksBulk", () => {
  const client = {} as ClickUpClient
  const config = {} as ApplicationConfig

  it("propagates parentTaskId from defaults and overrides", async () => {
    const input = {
      defaults: { listId: "list-1", parentTaskId: "parent-default" },
      subtasks: [
        { name: "Uses default" },
        { name: "Overrides", parentTaskId: "parent-override", listId: "list-2" }
      ],
      confirm: "yes" as const
    }

    await createSubtasksBulk(input as any, client, config)

    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ parentTaskId: "parent-default" }),
      client,
      undefined
    )
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({ parentTaskId: "parent-override", listId: "list-2" }),
      client,
      undefined
    )
  })

  it("errors when parentTaskId is missing after defaults", async () => {
    await expect(
      createSubtasksBulk({ subtasks: [{ name: "Missing parent" }], confirm: "yes" } as any, client, config)
    ).rejects.toThrow(/missing parentTaskId/)
  })
})
