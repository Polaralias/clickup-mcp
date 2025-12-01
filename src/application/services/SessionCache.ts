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
    private readonly hierarchyTtlMs: number = DEFAULT_TTL_MS,
    private readonly spaceConfigTtlMs: number = DEFAULT_TTL_MS
  ) {}

  getHierarchy(teamId: string): CachedHierarchy | null {
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

  setHierarchy(teamId: string, hierarchy: CachedHierarchy): void {
    if (this.hierarchyTtlMs <= 0) {
      return
    }
    const storedAt = this.resolveHierarchyTimestamp(hierarchy)
    this.hierarchyEntries.set(teamId, { value: hierarchy, storedAt })
  }

  invalidateHierarchy(teamId: string): void {
    this.hierarchyEntries.delete(teamId)
  }

  getSpaceConfig(teamId: string): CachedSpaceConfig | null {
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

  setSpaceConfig(teamId: string, config: CachedSpaceConfig): void {
    if (this.spaceConfigTtlMs <= 0) {
      return
    }
    const storedAt = this.resolveSpaceConfigTimestamp(config)
    this.spaceConfigEntries.set(teamId, { value: config, storedAt })
  }

  invalidateSpaceConfig(teamId: string): void {
    this.spaceConfigEntries.delete(teamId)
  }

  private isExpired(storedAt: number, ttlMs: number) {
    if (ttlMs <= 0) {
      return true
    }
    return Date.now() - storedAt > ttlMs
  }

  private resolveHierarchyTimestamp(hierarchy: CachedHierarchy) {
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

  private resolveSpaceConfigTimestamp(config: CachedSpaceConfig) {
    const timestamps = Object.values(config.tagsBySpaceId).map((entry) => entry.fetchedAt)
    return timestamps.length ? Math.min(...timestamps) : Date.now()
  }
}
