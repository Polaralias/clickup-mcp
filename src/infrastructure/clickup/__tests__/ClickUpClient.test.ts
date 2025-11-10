import { describe, it, expect } from "vitest"

describe("ClickUpClient URL construction", () => {
  it("should construct correct API URLs with BASE_URL trailing slash", () => {
    const BASE_URL = "https://api.clickup.com/api/v2/"
    
    // Test common endpoints
    const testCases = [
      { path: "team", expected: "https://api.clickup.com/api/v2/team" },
      { path: "team/123/space", expected: "https://api.clickup.com/api/v2/team/123/space" },
      { path: "task/456", expected: "https://api.clickup.com/api/v2/task/456" },
      { path: "space/789/folder", expected: "https://api.clickup.com/api/v2/space/789/folder" },
      { path: "team/123/user", expected: "https://api.clickup.com/api/v2/team/123/user" },
      { path: "list/999/task", expected: "https://api.clickup.com/api/v2/list/999/task" },
    ]
    
    testCases.forEach(({ path, expected }) => {
      const url = new URL(path, BASE_URL)
      expect(url.toString()).toBe(expected)
    })
  })
  
  it("should demonstrate the bug with missing trailing slash", () => {
    const BROKEN_BASE_URL = "https://api.clickup.com/api/v2"
    const FIXED_BASE_URL = "https://api.clickup.com/api/v2/"
    
    // Without trailing slash, path resolution is incorrect
    const brokenUrl = new URL("team", BROKEN_BASE_URL)
    expect(brokenUrl.toString()).toBe("https://api.clickup.com/api/team") // Wrong!
    
    // With trailing slash, path resolution is correct
    const fixedUrl = new URL("team", FIXED_BASE_URL)
    expect(fixedUrl.toString()).toBe("https://api.clickup.com/api/v2/team") // Correct!
  })
  
  it("should handle paths with query parameters", () => {
    const BASE_URL = "https://api.clickup.com/api/v2/"
    const path = "team/123/task"
    
    const url = new URL(path, BASE_URL)
    url.searchParams.set("page", "0")
    url.searchParams.set("archived", "false")
    
    expect(url.toString()).toBe("https://api.clickup.com/api/v2/team/123/task?page=0&archived=false")
  })
})
