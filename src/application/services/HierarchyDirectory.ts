import { CachedHierarchy, CachedHierarchyEntry, SessionCache } from "./SessionCache.js"

const DEFAULT_TTL_MS = 5 * 60 * 1000

export type HierarchyEnsureOptions = {
  forceRefresh?: boolean
}

type CacheMetadataScope = "workspaces" | "spaces" | "folders" | "lists"

export type HierarchyCacheMetadata = {
  scope: CacheMetadataScope
  key: string
  context?: Record<string, string | undefined>
  lastFetched: string
  ageMs: number
  expiresAt: string
  ttlMs: number
  stale: boolean
  totalItems: number
}

type CacheEntry<T> = {
  scope: CacheMetadataScope
  key: string
  items: T[]
  fetchedAt: number
  expiresAt: number
  context?: Record<string, string | undefined>
}

export type HierarchyDirectoryResult<T> = {
  items: T[]
  cache: HierarchyCacheMetadata
}

function ensureArray(candidate: unknown, property?: string): Record<string, unknown>[] {
  if (property && candidate && typeof candidate === "object") {
    const nested = (candidate as Record<string, unknown>)[property]
    if (Array.isArray(nested)) {
      return nested as Record<string, unknown>[]
    }
  }
  if (Array.isArray(candidate)) {
    return candidate as Record<string, unknown>[]
  }
  return []
}

function buildMetadata<T>(entry: CacheEntry<T>, ttlMs: number): HierarchyCacheMetadata {
  const now = Date.now()
  const ageMs = now - entry.fetchedAt
  return {
    scope: entry.scope,
    key: entry.key,
    context: entry.context,
    lastFetched: new Date(entry.fetchedAt).toISOString(),
    ageMs,
    expiresAt: new Date(entry.expiresAt).toISOString(),
    ttlMs,
    stale: ageMs > ttlMs,
    totalItems: entry.items.length
  }
}

export class HierarchyDirectory {
  private workspaces?: CacheEntry<Record<string, unknown>>
  private readonly spaces = new Map<string, CacheEntry<Record<string, unknown>>>()
  private readonly folders = new Map<string, CacheEntry<Record<string, unknown>>>()
  private readonly lists = new Map<string, CacheEntry<Record<string, unknown>>>()
  private readonly ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS, private readonly sessionCache?: SessionCache, private readonly teamId?: string) {
    this.ttlMs = ttlMs ?? DEFAULT_TTL_MS
    this.restoreFromSessionCache()
  }

  private toCacheEntry(
    scope: CacheMetadataScope,
    key: string,
    cached: CachedHierarchyEntry
  ): CacheEntry<Record<string, unknown>> | undefined {
    const expiresAt = cached.fetchedAt + this.ttlMs
    if (this.ttlMs <= 0 || Date.now() > expiresAt) {
      return undefined
    }
    return {
      scope,
      key,
      items: [...cached.items],
      fetchedAt: cached.fetchedAt,
      expiresAt,
      context: cached.context
    }
  }

  private restoreFromSessionCache() {
    if (!this.sessionCache || !this.teamId) {
      return
    }
    const cached = this.sessionCache.getHierarchy(this.teamId)
    if (!cached) {
      return
    }
    if (cached.workspaces) {
      this.workspaces = this.toCacheEntry("workspaces", "workspaces", cached.workspaces)
    }
    this.restoreMapEntries(this.spaces, "spaces", cached.spaces)
    this.restoreMapEntries(this.folders, "folders", cached.folders)
    this.restoreMapEntries(this.lists, "lists", cached.lists)
  }

  private restoreMapEntries(
    target: Map<string, CacheEntry<Record<string, unknown>>>,
    scope: CacheMetadataScope,
    entries?: Record<string, CachedHierarchyEntry>
  ) {
    if (!entries) {
      return
    }
    for (const [key, cached] of Object.entries(entries)) {
      const entry = this.toCacheEntry(scope, key, cached)
      if (entry) {
        target.set(key, entry)
      }
    }
  }

  private purgeExpired() {
    const now = Date.now()
    if (this.workspaces && now > this.workspaces.expiresAt) {
      this.workspaces = undefined
    }
    for (const [key, entry] of this.spaces.entries()) {
      if (now > entry.expiresAt) {
        this.spaces.delete(key)
      }
    }
    for (const [key, entry] of this.folders.entries()) {
      if (now > entry.expiresAt) {
        this.folders.delete(key)
      }
    }
    for (const [key, entry] of this.lists.entries()) {
      if (now > entry.expiresAt) {
        this.lists.delete(key)
      }
    }
  }

  private toCachedHierarchyEntry(entry: CacheEntry<Record<string, unknown>>): CachedHierarchyEntry {
    return {
      items: [...entry.items],
      fetchedAt: entry.fetchedAt,
      context: entry.context
    }
  }

  private persist() {
    this.purgeExpired()
    if (!this.sessionCache || !this.teamId || this.ttlMs <= 0) {
      return
    }
    const hierarchy: CachedHierarchy = {
      spaces: {},
      folders: {},
      lists: {}
    }
    if (this.workspaces) {
      hierarchy.workspaces = this.toCachedHierarchyEntry(this.workspaces)
    }
    for (const [key, entry] of this.spaces.entries()) {
      hierarchy.spaces[key] = this.toCachedHierarchyEntry(entry)
    }
    for (const [key, entry] of this.folders.entries()) {
      hierarchy.folders[key] = this.toCachedHierarchyEntry(entry)
    }
    for (const [key, entry] of this.lists.entries()) {
      hierarchy.lists[key] = this.toCachedHierarchyEntry(entry)
    }
    this.sessionCache.setHierarchy(this.teamId, hierarchy)
  }

  async ensureWorkspaces(
    fetchWorkspaces: () => Promise<unknown>,
    options: HierarchyEnsureOptions = {}
  ): Promise<HierarchyDirectoryResult<Record<string, unknown>>> {
    this.purgeExpired()
    const now = Date.now()
    const expired = this.workspaces ? now > this.workspaces.expiresAt : true

    if (!this.workspaces || expired || options.forceRefresh) {
      const response = await fetchWorkspaces()
      const workspaces = ensureArray(response, "teams")
      this.workspaces = {
        scope: "workspaces",
        key: "workspaces",
        items: workspaces,
        fetchedAt: now,
        expiresAt: now + this.ttlMs
      }
    }

    this.persist()
    return {
      items: this.workspaces.items,
      cache: buildMetadata(this.workspaces, this.ttlMs)
    }
  }

  async ensureSpaces(
    workspaceId: string,
    fetchSpaces: () => Promise<unknown>,
    options: HierarchyEnsureOptions = {}
  ): Promise<HierarchyDirectoryResult<Record<string, unknown>>> {
    this.purgeExpired()
    const key = workspaceId
    const existing = this.spaces.get(key)
    const now = Date.now()
    const expired = existing ? now > existing.expiresAt : true

    if (!existing || expired || options.forceRefresh) {
      const response = await fetchSpaces()
      const spaces = ensureArray(response, "spaces")
      const entry: CacheEntry<Record<string, unknown>> = {
        scope: "spaces",
        key,
        items: spaces,
        fetchedAt: now,
        expiresAt: now + this.ttlMs,
        context: { workspaceId }
      }
      this.spaces.set(key, entry)
      return {
        items: entry.items,
        cache: buildMetadata(entry, this.ttlMs)
      }
    }

    this.persist()
    return {
      items: existing.items,
      cache: buildMetadata(existing, this.ttlMs)
    }
  }

  async ensureFolders(
    spaceId: string,
    fetchFolders: () => Promise<unknown>,
    options: HierarchyEnsureOptions = {}
  ): Promise<HierarchyDirectoryResult<Record<string, unknown>>> {
    this.purgeExpired()
    const key = spaceId
    const existing = this.folders.get(key)
    const now = Date.now()
    const expired = existing ? now > existing.expiresAt : true

    if (!existing || expired || options.forceRefresh) {
      const response = await fetchFolders()
      const folders = ensureArray(response, "folders")
      const entry: CacheEntry<Record<string, unknown>> = {
        scope: "folders",
        key,
        items: folders,
        fetchedAt: now,
        expiresAt: now + this.ttlMs,
        context: { spaceId }
      }
      this.folders.set(key, entry)
      return {
        items: entry.items,
        cache: buildMetadata(entry, this.ttlMs)
      }
    }

    this.persist()
    return {
      items: existing.items,
      cache: buildMetadata(existing, this.ttlMs)
    }
  }

  async ensureLists(
    spaceId: string | undefined,
    folderId: string | undefined,
    fetchLists: () => Promise<unknown>,
    options: HierarchyEnsureOptions = {}
  ): Promise<HierarchyDirectoryResult<Record<string, unknown>>> {
    this.purgeExpired()
    const key = folderId ? `folder:${folderId}` : `space:${spaceId ?? ""}`
    const existing = this.lists.get(key)
    const now = Date.now()
    const expired = existing ? now > existing.expiresAt : true

    if (!existing || expired || options.forceRefresh) {
      const response = await fetchLists()
      const lists = ensureArray(response, "lists")
      const entry: CacheEntry<Record<string, unknown>> = {
        scope: "lists",
        key,
        items: lists,
        fetchedAt: now,
        expiresAt: now + this.ttlMs,
        context: {
          spaceId,
          folderId
        }
      }
      this.lists.set(key, entry)
      return {
        items: entry.items,
        cache: buildMetadata(entry, this.ttlMs)
      }
    }

    this.persist()
    return {
      items: existing.items,
      cache: buildMetadata(existing, this.ttlMs)
    }
  }

  invalidateWorkspaces() {
    this.workspaces = undefined
    this.invalidateSpaces()
    this.persist()
  }

  invalidateSpaces(workspaceId?: string) {
    if (!workspaceId) {
      this.spaces.clear()
      this.invalidateFolders()
      this.persist()
      return
    }
    this.spaces.delete(workspaceId)
    this.persist()
  }

  invalidateFolders(spaceId?: string) {
    if (!spaceId) {
      this.folders.clear()
      this.invalidateLists()
      this.persist()
      return
    }
    for (const [key, entry] of this.folders.entries()) {
      if (entry.context?.spaceId === spaceId || key === spaceId) {
        this.folders.delete(key)
      }
    }
    this.persist()
  }

  invalidateListsForSpace(spaceId: string) {
    for (const [key, entry] of this.lists.entries()) {
      if (entry.context?.spaceId === spaceId || key === `space:${spaceId}`) {
        this.lists.delete(key)
      }
    }
    this.persist()
  }

  invalidateListsForFolder(folderId: string) {
    for (const [key, entry] of this.lists.entries()) {
      if (entry.context?.folderId === folderId || key === `folder:${folderId}`) {
        this.lists.delete(key)
      }
    }
    this.persist()
  }

  private invalidateLists() {
    this.lists.clear()
    this.persist()
  }
}
