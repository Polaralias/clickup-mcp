const DEFAULT_CHAR_LIMIT = 16000

export function getCharLimit(): number {
  const configured = Number(process.env.CHAR_LIMIT ?? process.env.charLimit ?? DEFAULT_CHAR_LIMIT)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_CHAR_LIMIT
}

export function applyCharBudget(text: string) {
  const limit = getCharLimit()
  if (text.length <= limit) {
    return { value: text, truncated: false }
  }
  return { value: text.slice(0, limit), truncated: true }
}
