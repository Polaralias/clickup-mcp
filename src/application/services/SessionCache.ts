export type CachedHierarchyEntry = {
  items: Record<string, unknown>[]
  fetchedAt: number
  context?: Record<string, string | undefined>
}

export type CachedHierarchy = {
  workspaces?: CachedHierarchyEntry
  spaces: Record<string, CachedHierarchyEntry>
  folders: Record<string, CachedHierarchyEntry>
  lists: Record<string, CachedHierarchyEntry>
}

export type CachedSpaceConfigEntry = {
  tags: unknown[]
  fetchedAt: number
}

export type CachedSpaceConfig = {
  tagsBySpaceId: Record<string, CachedSpaceConfigEntry>
}

type TimedEntry<T> = {
  value: T
  storedAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000

export class SessionCache {
  private readonly hierarchyEntries = new Map<string, TimedEntry<CachedHierarchy>>()
  private readonly spaceConfigEntries = new Map<string, TimedEntry<CachedSpaceConfig>>()

  constructor(
    protected readonly hierarchyTtlMs: number = DEFAULT_TTL_MS,
    protected readonly spaceConfigTtlMs: number = DEFAULT_TTL_MS
  ) {}

  async getHierarchy(teamId: string): Promise<CachedHierarchy | null> {
    const entry = this.hierarchyEntries.get(teamId)
    if (!entry) {
      return null
    }
    if (this.isExpired(entry.storedAt, this.hierarchyTtlMs)) {
      this.hierarchyEntries.delete(teamId)
      return null
    }
    return entry.value
  }

  async setHierarchy(teamId: string, hierarchy: CachedHierarchy): Promise<void> {
    if (this.hierarchyTtlMs <= 0) {
      return
    }
    const storedAt = this.resolveHierarchyTimestamp(hierarchy)
    this.hierarchyEntries.set(teamId, { value: hierarchy, storedAt })
  }

  async invalidateHierarchy(teamId: string): Promise<void> {
    this.hierarchyEntries.delete(teamId)
  }

  async getSpaceConfig(teamId: string): Promise<CachedSpaceConfig | null> {
    const entry = this.spaceConfigEntries.get(teamId)
    if (!entry) {
      return null
    }
    if (this.isExpired(entry.storedAt, this.spaceConfigTtlMs)) {
      this.spaceConfigEntries.delete(teamId)
      return null
    }
    return entry.value
  }

  async setSpaceConfig(teamId: string, config: CachedSpaceConfig): Promise<void> {
    if (this.spaceConfigTtlMs <= 0) {
      return
    }
    const storedAt = this.resolveSpaceConfigTimestamp(config)
    this.spaceConfigEntries.set(teamId, { value: config, storedAt })
  }

  async invalidateSpaceConfig(teamId: string): Promise<void> {
    this.spaceConfigEntries.delete(teamId)
  }

  protected isExpired(storedAt: number, ttlMs: number) {
    if (ttlMs <= 0) {
      return true
    }
    return Date.now() - storedAt > ttlMs
  }

  protected resolveHierarchyTimestamp(hierarchy: CachedHierarchy) {
    const timestamps: number[] = []
    if (hierarchy.workspaces) {
      timestamps.push(hierarchy.workspaces.fetchedAt)
    }
    for (const entry of Object.values(hierarchy.spaces ?? {})) {
      timestamps.push(entry.fetchedAt)
    }
    for (const entry of Object.values(hierarchy.folders ?? {})) {
      timestamps.push(entry.fetchedAt)
    }
    for (const entry of Object.values(hierarchy.lists ?? {})) {
      timestamps.push(entry.fetchedAt)
    }
    return timestamps.length ? Math.min(...timestamps) : Date.now()
  }

  protected resolveSpaceConfigTimestamp(config: CachedSpaceConfig) {
    const timestamps = Object.values(config.tagsBySpaceId).map((entry) => entry.fetchedAt)
    return timestamps.length ? Math.min(...timestamps) : Date.now()
  }
}
