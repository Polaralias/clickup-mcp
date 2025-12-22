import { describe, expect, it } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerTools } from "../registerTools.js"
import type { ApplicationConfig } from "../../application/config/applicationConfig.js"
import { SessionCache } from "../../application/services/SessionCache.js"

const baseConfig: ApplicationConfig = {
  teamId: "test-team",
  apiKey: "test-api-key",
  charLimit: 16000,
  maxAttachmentMb: 8,
  writeMode: "write",
  writeAccess: { mode: "write", allowedSpaces: new Set(), allowedLists: new Set() },
  hierarchyCacheTtlMs: 300000,
  spaceConfigCacheTtlMs: 300000,
  reportingMaxTasks: 200,
  defaultRiskWindowDays: 5
}

describe("annotations compliance", () => {
  it("generates annotations with full descriptive keys", () => {
    const config: ApplicationConfig = { ...baseConfig }
    const sessionCache = new SessionCache()

    const server = new McpServer({
      name: "Test Server",
      version: "1.0.0"
    })

    registerTools(server, config, sessionCache)

    // Access registered tools (using internal property for testing)
    const registeredTools = (server as any)._registeredTools

    // Check workspace_list (read-only tool)
    const workspaceListTool = registeredTools["workspace_list"]
    expect(workspaceListTool).toBeDefined()
    const workspaceListAnnotations = workspaceListTool.annotations

    // Check for absence of short keys
    expect(workspaceListAnnotations).not.toHaveProperty("m")
    expect(workspaceListAnnotations).not.toHaveProperty("c")
    expect(workspaceListAnnotations).not.toHaveProperty("i")
    expect(workspaceListAnnotations).not.toHaveProperty("s")
    expect(workspaceListAnnotations).not.toHaveProperty("ch")

    // Check for presence of full keys
    expect(workspaceListAnnotations).toHaveProperty("category", "hierarchy")
    expect(workspaceListAnnotations).toHaveProperty("intent", "workspace list")
    expect(workspaceListAnnotations).toHaveProperty("scope", "workspace")
    // 'cache' might depend on implementation details of mapping, but assuming we map ch -> cache
    expect(workspaceListAnnotations).toHaveProperty("cache")
    expect(workspaceListAnnotations).toHaveProperty("readOnlyHint", true)


    // Check task_create (destructive tool)
    const taskCreateTool = registeredTools["task_create"]
    expect(taskCreateTool).toBeDefined()
    const taskCreateAnnotations = taskCreateTool.annotations

    expect(taskCreateAnnotations).not.toHaveProperty("m")
    expect(taskCreateAnnotations).not.toHaveProperty("d")
    expect(taskCreateAnnotations).toHaveProperty("destructiveHint", true)
    expect(taskCreateAnnotations).toHaveProperty("dryRun", true)
    expect(taskCreateAnnotations).toHaveProperty("category", "task")
    expect(taskCreateAnnotations).toHaveProperty("intent", "create task")
  })
})
