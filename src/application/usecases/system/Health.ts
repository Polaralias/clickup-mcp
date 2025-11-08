import { getCharLimit } from "../../limits/tokenBudget.js"

export async function health() {
  return {
    name: "ClickUp MCP",
    version: "1.0.0",
    pid: process.pid,
    charLimit: getCharLimit(),
    features: ["http", "stdio"],
    uptimeSeconds: process.uptime()
  }
}
