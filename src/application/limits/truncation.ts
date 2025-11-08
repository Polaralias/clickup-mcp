export function truncateList<T>(items: T[], limit: number) {
  if (items.length <= limit) {
    return { items, truncated: false }
  }
  return { items: items.slice(0, limit), truncated: true }
}

export function truncateString(value: string, limit: number) {
  if (value.length <= limit) {
    return { value, truncated: false }
  }
  return { value: value.slice(0, limit), truncated: true }
}
