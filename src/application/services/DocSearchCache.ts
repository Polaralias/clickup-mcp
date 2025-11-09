const DEFAULT_TTL_MS = 60 * 1000
const DEFAULT_MAX_ENTRIES = 100
const DEFAULT_MAX_DOC_PAGES = 200

type CacheKey = {
  query: string
  limit: number
  expandPages: boolean
}

type CacheEntry = {
  key: string
  query: string
  limit: number
  expandPages: boolean
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
  fetchedAt: number
  expiresAt: number
  docIds: string[]
  pageIndex: Record<string, string[]>
}

type CachedDocPages = {
  docId: string
  pages: unknown[]
  fetchedAt: number
  expiresAt: number
  pageIds: string[]
}

type CacheOptions = {
  ttlMs?: number
  maxEntries?: number
  maxDocPages?: number
}

type GetOptions = {
  forceRefresh?: boolean
}

type StorePayload = {
  docs: Array<Record<string, unknown>>
  expandedPages?: Record<string, unknown[]>
}

function buildKey(key: CacheKey) {
  return [key.query, `limit:${key.limit}`, key.expandPages ? "expand:1" : "expand:0"].join("|")
}

function resolveDocId(doc: Record<string, unknown>) {
  const candidates = [doc.id, doc.doc_id, doc.docId]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }
  return undefined
}

function resolvePageId(page: Record<string, unknown>) {
  const candidates = [page.id, page.page_id, page.pageId]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }
  return undefined
}

function now() {
  return Date.now()
}

export class DocSearchCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly docIndex = new Map<string, Set<string>>()
  private readonly pageIndex = new Map<string, Set<string>>()
  private readonly docPages = new Map<string, CachedDocPages>()

  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly maxDocPages: number

  constructor(options: CacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
    this.maxDocPages = options.maxDocPages ?? DEFAULT_MAX_DOC_PAGES
  }

  get(key: CacheKey, options: GetOptions = {}) {
    const cacheKey = buildKey(key)
    const cached = this.entries.get(cacheKey)
    if (!cached) {
      return undefined
    }
    if (options.forceRefresh) {
      this.deleteEntry(cacheKey)
      return undefined
    }
    if (cached.expiresAt <= now()) {
      this.deleteEntry(cacheKey)
      return undefined
    }
    return { docs: cached.docs, expandedPages: cached.expandedPages }
  }

  store(key: CacheKey, payload: StorePayload) {
    const cacheKey = buildKey(key)
    const timestamp = now()
    const entry: CacheEntry = {
      key: cacheKey,
      query: key.query,
      limit: key.limit,
      expandPages: key.expandPages,
      docs: payload.docs,
      expandedPages: payload.expandedPages,
      fetchedAt: timestamp,
      expiresAt: timestamp + this.ttlMs,
      docIds: [],
      pageIndex: {}
    }

    for (const doc of payload.docs) {
      const docId = resolveDocId(doc as Record<string, unknown>)
      if (!docId) {
        continue
      }
      entry.docIds.push(docId)
      this.bindDocToEntry(docId, cacheKey)
    }

    if (payload.expandedPages) {
      for (const [docId, pages] of Object.entries(payload.expandedPages)) {
        if (!docId) continue
        const pageIds: string[] = []
        for (const page of pages) {
          if (page && typeof page === "object") {
            const id = resolvePageId(page as Record<string, unknown>)
            if (id) {
              pageIds.push(id)
              this.bindPageToEntry(docId, id, cacheKey)
            }
          }
        }
        entry.pageIndex[docId] = pageIds
        this.storeDocPages(docId, pages, timestamp)
      }
    }

    this.entries.set(cacheKey, entry)
    this.enforceEntryLimit()
  }

  getDocPages(docId: string, options: GetOptions = {}) {
    const cached = this.docPages.get(docId)
    if (!cached) {
      return undefined
    }
    if (options.forceRefresh) {
      this.docPages.delete(docId)
      return undefined
    }
    if (cached.expiresAt <= now()) {
      this.docPages.delete(docId)
      return undefined
    }
    return cached.pages
  }

  invalidateAll() {
    this.entries.clear()
    this.docIndex.clear()
    this.pageIndex.clear()
    this.docPages.clear()
  }

  invalidateDoc(docId: string) {
    const keys = this.docIndex.get(docId)
    if (keys) {
      for (const key of keys) {
        this.deleteEntry(key)
      }
    }
    this.docPages.delete(docId)
  }

  invalidateDocPage(docId: string, pageId: string) {
    const composite = this.buildPageKey(docId, pageId)
    const keys = this.pageIndex.get(composite)
    if (keys) {
      for (const key of keys) {
        this.deleteEntry(key)
      }
    }
    this.docPages.delete(docId)
  }

  private enforceEntryLimit() {
    const excess = this.entries.size - this.maxEntries
    if (excess <= 0) {
      return
    }
    const sorted = Array.from(this.entries.values()).sort((a, b) => a.fetchedAt - b.fetchedAt)
    for (let i = 0; i < excess; i += 1) {
      this.deleteEntry(sorted[i]?.key)
    }
  }

  private enforceDocPageLimit() {
    const excess = this.docPages.size - this.maxDocPages
    if (excess <= 0) {
      return
    }
    const sorted = Array.from(this.docPages.values()).sort((a, b) => a.fetchedAt - b.fetchedAt)
    for (let i = 0; i < excess; i += 1) {
      const candidate = sorted[i]
      if (candidate) {
        this.docPages.delete(candidate.docId)
      }
    }
  }

  private deleteEntry(key?: string) {
    if (!key) {
      return
    }
    const cached = this.entries.get(key)
    if (!cached) {
      return
    }
    this.entries.delete(key)
    for (const docId of cached.docIds) {
      const keys = this.docIndex.get(docId)
      if (keys) {
        keys.delete(key)
        if (keys.size === 0) {
          this.docIndex.delete(docId)
        }
      }
    }
    for (const [docId, pageIds] of Object.entries(cached.pageIndex)) {
      for (const pageId of pageIds) {
        const composite = this.buildPageKey(docId, pageId)
        const keys = this.pageIndex.get(composite)
        if (keys) {
          keys.delete(key)
          if (keys.size === 0) {
            this.pageIndex.delete(composite)
          }
        }
      }
    }
  }

  private bindDocToEntry(docId: string, key: string) {
    const existing = this.docIndex.get(docId)
    if (existing) {
      existing.add(key)
    } else {
      this.docIndex.set(docId, new Set([key]))
    }
  }

  private bindPageToEntry(docId: string, pageId: string, key: string) {
    const composite = this.buildPageKey(docId, pageId)
    const existing = this.pageIndex.get(composite)
    if (existing) {
      existing.add(key)
    } else {
      this.pageIndex.set(composite, new Set([key]))
    }
  }

  private buildPageKey(docId: string, pageId: string) {
    return `${docId}::${pageId}`
  }

  private storeDocPages(docId: string, pages: unknown[], fetchedAt: number) {
    this.docPages.set(docId, {
      docId,
      pages,
      fetchedAt,
      expiresAt: fetchedAt + this.ttlMs,
      pageIds: pages
        .map((page) => (page && typeof page === "object" ? resolvePageId(page as Record<string, unknown>) : undefined))
        .filter((id): id is string => Boolean(id))
    })
    this.enforceDocPageLimit()
  }
}
