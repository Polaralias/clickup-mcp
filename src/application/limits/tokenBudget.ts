import type { ApplicationConfig } from "../config/applicationConfig.js"
import { getCharLimit } from "../config/applicationConfig.js"

export function applyCharBudget(text: string, config: ApplicationConfig) {
  const limit = getCharLimit(config)
  if (text.length <= limit) {
    return { value: text, truncated: false }
  }
  return { value: text.slice(0, limit), truncated: true }
}
