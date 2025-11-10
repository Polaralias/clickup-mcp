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

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  async ensureWorkspaces(
    fetchWorkspaces: () => Promise<unknown>,
    options: HierarchyEnsureOptions = {}
  ): Promise<HierarchyDirectoryResult<Record<string, unknown>>> {
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

    return {
      items: existing.items,
      cache: buildMetadata(existing, this.ttlMs)
    }
  }

  invalidateWorkspaces() {
    this.workspaces = undefined
    this.invalidateSpaces()
  }

  invalidateSpaces(workspaceId?: string) {
    if (!workspaceId) {
      this.spaces.clear()
      this.invalidateFolders()
      return
    }
    this.spaces.delete(workspaceId)
  }

  invalidateFolders(spaceId?: string) {
    if (!spaceId) {
      this.folders.clear()
      this.invalidateLists()
      return
    }
    for (const [key, entry] of this.folders.entries()) {
      if (entry.context?.spaceId === spaceId || key === spaceId) {
        this.folders.delete(key)
      }
    }
  }

  invalidateListsForSpace(spaceId: string) {
    for (const [key, entry] of this.lists.entries()) {
      if (entry.context?.spaceId === spaceId || key === `space:${spaceId}`) {
        this.lists.delete(key)
      }
    }
  }

  invalidateListsForFolder(folderId: string) {
    for (const [key, entry] of this.lists.entries()) {
      if (entry.context?.folderId === folderId || key === `folder:${folderId}`) {
        this.lists.delete(key)
      }
    }
  }

  private invalidateLists() {
    this.lists.clear()
  }
}
