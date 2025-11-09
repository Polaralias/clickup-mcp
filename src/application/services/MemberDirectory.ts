import Fuse from "fuse.js"
import type { IFuseOptions } from "fuse.js"

type Identifier = {
  value: string
  source: string
  normalized: string
  tokens: string[]
}

type MemberRecord = {
  id: string
  displayName: string
  email?: string
  username?: string
  identifiers: Identifier[]
  keywords: string[]
  raw: Record<string, unknown>
}

type CachedTeam = {
  teamId: string
  fetchedAt: number
  expiresAt: number
  members: MemberRecord[]
  fuse: Fuse<MemberRecord>
}

export type MemberMatch = {
  memberId: string
  member: Record<string, unknown>
  displayName?: string
  email?: string
  username?: string
  score: number
  matched: string[]
  reasons: string[]
}

export type MemberDirectoryCacheMetadata = {
  teamId: string
  lastFetched: string
  ageMs: number
  expiresAt: string
  ttlMs: number
  stale: boolean
  totalMembers: number
}

type EnsureOptions = {
  forceRefresh?: boolean
}

type SearchOptions = EnsureOptions & {
  limit?: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_LIMIT = 5

const fuseOptions: IFuseOptions<MemberRecord> = {
  includeScore: true,
  shouldSort: true,
  threshold: 0.35,
  ignoreLocation: true,
  distance: 100,
  keys: [
    { name: "displayName", weight: 0.45 },
    { name: "email", weight: 0.2 },
    { name: "username", weight: 0.15 },
    { name: "keywords", weight: 0.2 }
  ]
}

function normalizeValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value: string) {
  return normalizeValue(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
}

function collect(values: Array<{ value?: unknown; source: string }>) {
  const identifiers: Identifier[] = []
  const seen = new Set<string>()

  values.forEach(({ value, source }) => {
    if (value === undefined || value === null) return
    const text = String(value).trim()
    if (!text) return
    const normalized = normalizeValue(text)
    if (!normalized) return
    const key = `${source}:${normalized}`
    if (seen.has(key)) return
    seen.add(key)
    identifiers.push({ value: text, source, normalized, tokens: tokenize(text) })
  })

  return identifiers
}

function unique<T>(values: T[]) {
  const seen = new Set<T>()
  const result: T[] = []
  values.forEach((value) => {
    if (value === undefined || value === null) return
    if (!seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  })
  return result
}

function extractMemberRecord(member: Record<string, any>): MemberRecord | null {
  const identifiers = collect([
    { value: member.id, source: "id" },
    { value: member.user_id, source: "user_id" },
    { value: member.user?.id, source: "user.id" },
    { value: member.email, source: "email" },
    { value: member.user?.email, source: "user.email" },
    { value: member.username, source: "username" },
    { value: member.user?.username, source: "user.username" },
    { value: member.name, source: "name" },
    { value: member.user?.name, source: "user.name" },
    { value: member.user?.display_name, source: "user.display_name" },
    { value: member.user?.profile?.full_name, source: "user.profile.full_name" },
    { value: member.user?.profile?.first_name, source: "user.profile.first_name" },
    { value: member.user?.profile?.last_name, source: "user.profile.last_name" },
    { value: member.user?.profile?.username, source: "user.profile.username" },
    { value: member.user?.profile?.email, source: "user.profile.email" },
    { value: member.user?.email?.split?.("@")[0], source: "user.email.local" },
    { value: member.email?.split?.("@")[0], source: "email.local" }
  ])

  if (identifiers.length === 0) {
    return null
  }

  const keywords = unique(
    identifiers.flatMap((identifier) => [identifier.value, ...identifier.tokens])
  )

  const id = identifiers.find((identifier) => identifier.source === "id")?.value
    ?? identifiers[0]?.value

  if (!id) {
    return null
  }

  const displayName =
    identifiers.find((identifier) => identifier.source === "name")?.value ??
    identifiers.find((identifier) => identifier.source === "user.name")?.value ??
    identifiers.find((identifier) => identifier.source === "user.display_name")?.value ??
    identifiers.find((identifier) => identifier.source === "username")?.value ??
    identifiers.find((identifier) => identifier.source === "user.username")?.value ??
    identifiers.find((identifier) => identifier.source === "email")?.value ??
    identifiers.find((identifier) => identifier.source === "user.email")?.value ??
    id

  const email =
    identifiers.find((identifier) => identifier.source === "email")?.value ??
    identifiers.find((identifier) => identifier.source === "user.email")?.value

  const username =
    identifiers.find((identifier) => identifier.source === "username")?.value ??
    identifiers.find((identifier) => identifier.source === "user.username")?.value

  return {
    id: String(id),
    displayName,
    email,
    username,
    identifiers,
    keywords,
    raw: member
  }
}

type RankedCandidate = {
  record: MemberRecord
  score: number
  matched: Set<string>
  reasons: Set<string>
}

function toMatch(candidate: RankedCandidate): MemberMatch {
  return {
    memberId: candidate.record.id,
    member: candidate.record.raw,
    displayName: candidate.record.displayName,
    email: candidate.record.email,
    username: candidate.record.username,
    score: Number(candidate.score.toFixed(4)),
    matched: Array.from(candidate.matched),
    reasons: Array.from(candidate.reasons)
  }
}

type PreparedQuery = {
  raw: string
  normalized: string
  tokens: string[]
}

function prepareQuery(query: string): PreparedQuery | null {
  const raw = query?.trim()
  if (!raw) return null
  const normalized = normalizeValue(raw)
  if (!normalized) return null
  const tokens = tokenize(raw)
  return { raw, normalized, tokens }
}

export class MemberDirectory {
  private readonly cache = new Map<string, CachedTeam>()

  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  async ensure(
    teamId: string,
    fetchMembers: () => Promise<unknown>,
    options: EnsureOptions = {}
  ): Promise<CachedTeam> {
    const now = Date.now()
    const cached = this.cache.get(teamId)
    const expired = cached ? now > cached.expiresAt : true

    if (!cached || expired || options.forceRefresh) {
      const response = await fetchMembers()
      const members: Record<string, unknown>[] = Array.isArray((response as any)?.members)
        ? ((response as any).members as Record<string, unknown>[])
        : Array.isArray(response)
          ? (response as Record<string, unknown>[])
          : []
      const records = members
        .map((member: Record<string, unknown>) => extractMemberRecord(member as Record<string, any>))
        .filter((record): record is MemberRecord => Boolean(record))
      const fuse = new Fuse<MemberRecord>(records, fuseOptions)
      const entry: CachedTeam = {
        teamId,
        members: records,
        fuse,
        fetchedAt: now,
        expiresAt: now + this.ttlMs
      }
      this.cache.set(teamId, entry)
      return entry
    }

    return cached
  }

  describe(entry: CachedTeam): MemberDirectoryCacheMetadata {
    const now = Date.now()
    const ageMs = now - entry.fetchedAt
    return {
      teamId: entry.teamId,
      lastFetched: new Date(entry.fetchedAt).toISOString(),
      ageMs,
      expiresAt: new Date(entry.expiresAt).toISOString(),
      ttlMs: this.ttlMs,
      stale: ageMs > this.ttlMs,
      totalMembers: entry.members.length
    }
  }

  async prepare(
    teamId: string,
    fetchMembers: () => Promise<unknown>,
    options: EnsureOptions = {}
  ) {
    const entry = await this.ensure(teamId, fetchMembers, options)
    return { entry, cache: this.describe(entry) }
  }

  async search(
    teamId: string,
    query: string,
    fetchMembers: () => Promise<unknown>,
    options: SearchOptions = {}
  ) {
    const { entry, cache } = await this.prepare(teamId, fetchMembers, options)
    const matches = this.rank(entry, query, options.limit)
    return { matches, cache }
  }

  rank(entry: CachedTeam, query: string, limit = DEFAULT_LIMIT) {
    const prepared = prepareQuery(query)
    if (!prepared) {
      return []
    }

    const limitValue = limit ?? DEFAULT_LIMIT
    const candidates = new Map<string, RankedCandidate>()

    const push = (record: MemberRecord, score: number, reason?: string, matched?: string) => {
      const existing = candidates.get(record.id)
      if (!existing) {
        const candidate: RankedCandidate = {
          record,
          score,
          matched: new Set(matched ? [matched] : []),
          reasons: new Set(reason ? [reason] : [])
        }
        candidates.set(record.id, candidate)
        return
      }
      if (reason) existing.reasons.add(reason)
      if (matched) existing.matched.add(matched)
      if (score < existing.score) {
        existing.score = score
      }
    }

    const fuseResults = entry.fuse.search(prepared.raw, {
      limit: Math.max(limitValue, DEFAULT_LIMIT)
    })
    fuseResults.forEach((result) => {
      const score = result.score ?? 1
      push(result.item, score, "Fuzzy similarity", result.item.displayName)
    })

    entry.members.forEach((record) => {
      record.identifiers.forEach((identifier) => {
        if (!identifier.normalized) return
        if (identifier.normalized === prepared.normalized) {
          push(record, 0, `Exact ${identifier.source} match`, identifier.value)
          return
        }
        if (identifier.normalized.startsWith(prepared.normalized)) {
          push(record, 0.02, `Prefix match on ${identifier.source}`, identifier.value)
        }
        if (identifier.normalized.includes(prepared.normalized)) {
          push(record, 0.08, `Substring match on ${identifier.source}`, identifier.value)
        }
        if (prepared.tokens.length > 0) {
          const tokenSet = new Set(identifier.tokens)
          const coversAllTokens = prepared.tokens.every((token) => tokenSet.has(token))
          if (coversAllTokens) {
            push(record, 0.05, `Token match within ${identifier.source}`, identifier.value)
          } else {
            prepared.tokens.forEach((token) => {
              if (tokenSet.has(token)) {
                push(record, 0.12, `Partial token match in ${identifier.source}`, token)
              }
            })
          }
        }
      })
    })

    const ranked = Array.from(candidates.values())
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score
        return a.record.displayName.localeCompare(b.record.displayName)
      })
      .slice(0, limitValue)
      .map(toMatch)

    return ranked
  }

  clear(teamId?: string) {
    if (!teamId) {
      this.cache.clear()
      return
    }
    this.cache.delete(teamId)
  }
}

