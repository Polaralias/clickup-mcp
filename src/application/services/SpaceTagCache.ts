const DEFAULT_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  tags: unknown[]
  fetchedAt: number
  expiresAt: number
}

export class SpaceTagCache {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  read(spaceId: string): unknown[] | undefined {
    const entry = this.entries.get(spaceId)
    if (!entry) {
      return undefined
    }
    const now = Date.now()
    if (now > entry.expiresAt) {
      this.entries.delete(spaceId)
      return undefined
    }
    return [...entry.tags]
  }

  store(spaceId: string, tags: unknown[]): void {
    const now = Date.now()
    this.entries.set(spaceId, {
      tags: [...tags],
      fetchedAt: now,
      expiresAt: now + this.ttlMs
    })
  }

  invalidate(spaceId: string): void {
    this.entries.delete(spaceId)
  }

  clear(): void {
    this.entries.clear()
  }
}
