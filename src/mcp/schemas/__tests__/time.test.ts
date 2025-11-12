import { describe, expect, it } from "vitest"
import { ListTimeEntriesInput } from "../time.js"

describe("ListTimeEntriesInput time boundaries", () => {
  const base = { page: 0, pageSize: 20 }

  it("accepts ISO 8601 strings", () => {
    const result = ListTimeEntriesInput.parse({
      ...base,
      from: "2024-01-01T00:00:00Z",
      to: "2024-01-02T00:00:00Z"
    })

    expect(result.from).toBe("2024-01-01T00:00:00Z")
    expect(result.to).toBe("2024-01-02T00:00:00Z")
  })

  it("accepts epoch seconds numbers", () => {
    const result = ListTimeEntriesInput.parse({
      ...base,
      from: 1_700_000_000,
      to: 1_700_086_400
    })

    expect(result.from).toBe(1_700_000_000)
    expect(result.to).toBe(1_700_086_400)
  })

  it("accepts epoch millisecond numbers", () => {
    const result = ListTimeEntriesInput.parse({
      ...base,
      from: 1_700_000_000_000,
      to: 1_700_086_400_000
    })

    expect(result.from).toBe(1_700_000_000_000)
    expect(result.to).toBe(1_700_086_400_000)
  })

  it("rejects malformed boundaries", () => {
    const result = ListTimeEntriesInput.safeParse({
      ...base,
      from: "not-a-date",
      to: "also-not-a-date"
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain(
        "From must be an ISO 8601 / RFC3339 string or epoch seconds/milliseconds number."
      )
      expect(messages).toContain(
        "To must be an ISO 8601 / RFC3339 string or epoch seconds/milliseconds number."
      )
    }
  })

  it("rejects numeric timestamps supplied as strings", () => {
    const result = ListTimeEntriesInput.safeParse({
      ...base,
      from: "1700000000",
      to: "1700086400000"
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain("From numeric timestamps must be passed as numbers, not strings.")
      expect(messages).toContain("To numeric timestamps must be passed as numbers, not strings.")
    }
  })
})
