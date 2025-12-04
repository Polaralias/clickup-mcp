import { describe, expect, it } from "vitest"
import { SearchTasksInput } from "../task.js"

const baseInput = { page: 0, pageSize: 20 }

describe("SearchTasksInput", () => {
  it("accepts a single status string", () => {
    const result = SearchTasksInput.parse({ ...baseInput, status: "Open" })
    expect(result.status).toBe("Open")
    expect(result.statuses).toBeUndefined()
  })

  it("accepts a statuses array", () => {
    const result = SearchTasksInput.parse({
      ...baseInput,
      statuses: ["Open", "Closed"]
    })
    expect(result.status).toBeUndefined()
    expect(result.statuses).toEqual(["Open", "Closed"])
  })

  it("rejects when both status modes are provided", () => {
    const outcome = SearchTasksInput.safeParse({
      ...baseInput,
      status: "Open",
      statuses: ["Closed"]
    })
    expect(outcome.success).toBe(false)
    if (!outcome.success) {
      expect(outcome.error.issues[0]?.message).toContain("Use status or statuses")
    }
  })

  it("rejects empty statuses arrays", () => {
    const outcome = SearchTasksInput.safeParse({ ...baseInput, statuses: [] })
    expect(outcome.success).toBe(false)
  })

  it("accepts tag names as filters", () => {
    const result = SearchTasksInput.parse({ ...baseInput, tagIds: ["alpha", "beta"] })
    expect(result.tagIds).toEqual(["alpha", "beta"])
  })

  it("defaults includeTasksInMultipleLists to true", () => {
    const result = SearchTasksInput.parse(baseInput)
    expect(result.includeTasksInMultipleLists).toBe(true)
  })

  it("allows includeTasksInMultipleLists to be disabled", () => {
    const result = SearchTasksInput.parse({ ...baseInput, includeTasksInMultipleLists: false })
    expect(result.includeTasksInMultipleLists).toBe(false)
  })
})
