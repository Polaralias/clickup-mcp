import type { CorsOptions } from "cors"

export function createCorsOptions(): CorsOptions {
  return {
    origin: true,
    credentials: true,
    allowedHeaders: ["content-type", "authorization", "mcp-session-id"],
    exposedHeaders: ["mcp-session-id", "mcp-protocol-version"],
    methods: ["GET", "POST", "OPTIONS"],
    preflightContinue: false
  }
}
