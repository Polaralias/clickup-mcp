import type { ApplicationConfig } from "../../config/applicationConfig.js"
import { getCharLimit } from "../../config/applicationConfig.js"

export async function health(config: ApplicationConfig) {
  return {
    name: "ClickUp MCP",
    version: "1.0.0",
    pid: process.pid,
    charLimit: getCharLimit(config),
    features: ["http", "stdio"],
    uptimeSeconds: process.uptime()
  }
}
