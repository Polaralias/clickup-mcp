import { CachedSpaceConfig, SessionCache } from "./SessionCache.js"

const DEFAULT_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  tags: unknown[]
  fetchedAt: number
  expiresAt: number
}

export class SpaceTagCache {
  private readonly entries = new Map<string, CacheEntry>()

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS, private readonly sessionCache?: SessionCache, private readonly teamId?: string) {
    this.restoreFromSessionCache()
  }

  private restoreFromSessionCache() {
    if (!this.sessionCache || !this.teamId) {
      return
    }
    const cached = this.sessionCache.getSpaceConfig(this.teamId)
    if (!cached) {
      return
    }
    const now = Date.now()
    for (const [spaceId, entry] of Object.entries(cached.tagsBySpaceId)) {
      const expiresAt = entry.fetchedAt + this.ttlMs
      if (this.ttlMs <= 0 || now > expiresAt) {
        continue
      }
      this.entries.set(spaceId, {
        tags: [...entry.tags],
        fetchedAt: entry.fetchedAt,
        expiresAt
      })
    }
  }

  private purgeExpired() {
    const now = Date.now()
    for (const [spaceId, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(spaceId)
      }
    }
  }

  private persist() {
    this.purgeExpired()
    if (!this.sessionCache || !this.teamId || this.ttlMs <= 0) {
      return
    }
    const config: CachedSpaceConfig = { tagsBySpaceId: {} }
    for (const [spaceId, entry] of this.entries.entries()) {
      config.tagsBySpaceId[spaceId] = {
        tags: [...entry.tags],
        fetchedAt: entry.fetchedAt
      }
    }
    this.sessionCache.setSpaceConfig(this.teamId, config)
  }

  read(spaceId: string): unknown[] | undefined {
    this.purgeExpired()
    const entry = this.entries.get(spaceId)
    if (!entry) {
      return undefined
    }
    const now = Date.now()
    if (now > entry.expiresAt) {
      this.entries.delete(spaceId)
      this.persist()
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
    this.persist()
  }

  invalidate(spaceId: string): void {
    this.entries.delete(spaceId)
    this.persist()
  }

  clear(): void {
    this.entries.clear()
    this.persist()
  }
}
