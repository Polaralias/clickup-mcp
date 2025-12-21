import { describe, it, expect } from "vitest"
import { buildViewFilters } from "../structureShared.js"

describe("buildViewFilters", () => {
  it("returns undefined if no filters provided", () => {
    expect(buildViewFilters()).toBeUndefined()
    expect(buildViewFilters([], [])).toBeUndefined()
  })

  it("returns simple status object if only statuses provided", () => {
    const filters = buildViewFilters(["open", "closed"])
    expect(filters).toEqual({ statuses: ["open", "closed"] })
  })

  it("returns complex object if tags provided", () => {
    const filters = buildViewFilters(undefined, ["bug"])
    expect(filters).toEqual({
      op: "AND",
      fields: [
        {
          field: "tag",
          op: "ANY",
          values: ["bug"]
        }
      ],
      search: "",
      show_closed: false
    })
  })

  it("returns complex object if both statuses and tags provided", () => {
    const filters = buildViewFilters(["open"], ["bug"])
    expect(filters).toEqual({
      op: "AND",
      fields: [
        {
          field: "status",
          op: "EQ",
          values: ["open"]
        },
        {
          field: "tag",
          op: "ANY",
          values: ["bug"]
        }
      ],
      search: "",
      show_closed: false
    })
  })
})
