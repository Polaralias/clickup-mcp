import { CachedSpaceConfig, SessionCache } from "./SessionCache.js"

const DEFAULT_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  tags: unknown[]
  fetchedAt: number
  expiresAt: number
}

export class SpaceTagCache {
  private readonly entries = new Map<string, CacheEntry>()
  private loaded = false

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS, private readonly sessionCache?: SessionCache, private readonly teamId?: string) {
  }

  private async loadIfNeeded() {
    if (this.loaded || !this.sessionCache || !this.teamId) {
      return
    }
    const cached = await this.sessionCache.getSpaceConfig(this.teamId)
    this.loaded = true
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

  private async persist() {
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
    await this.sessionCache.setSpaceConfig(this.teamId, config)
  }

  async read(spaceId: string): Promise<unknown[] | undefined> {
    await this.loadIfNeeded()
    this.purgeExpired()
    const entry = this.entries.get(spaceId)
    if (!entry) {
      return undefined
    }
    const now = Date.now()
    if (now > entry.expiresAt) {
      this.entries.delete(spaceId)
      await this.persist()
      return undefined
    }
    return [...entry.tags]
  }

  async store(spaceId: string, tags: unknown[]): Promise<void> {
    await this.loadIfNeeded()
    const now = Date.now()
    this.entries.set(spaceId, {
      tags: [...tags],
      fetchedAt: now,
      expiresAt: now + this.ttlMs
    })
    await this.persist()
  }

  async invalidate(spaceId: string): Promise<void> {
    await this.loadIfNeeded()
    this.entries.delete(spaceId)
    await this.persist()
  }

  async clear(): Promise<void> {
    this.entries.clear()
    await this.persist()
  }
}
