import { SessionCache, CachedHierarchy, CachedSpaceConfig } from "../../application/services/SessionCache.js"
import { CacheRepository } from "../repositories/CacheRepository.js"

export class PostgresSessionCache extends SessionCache {
  constructor(
    private repo: CacheRepository,
    hierarchyTtlMs?: number,
    spaceConfigTtlMs?: number
  ) {
    super(hierarchyTtlMs, spaceConfigTtlMs)
  }

  async getHierarchy(teamId: string): Promise<CachedHierarchy | null> {
    const key = `hierarchy:${teamId}`
    const result = await this.repo.get(key)
    if (!result) return null
    return result.value as CachedHierarchy
  }

  async setHierarchy(teamId: string, hierarchy: CachedHierarchy): Promise<void> {
    const key = `hierarchy:${teamId}`
    await this.repo.set(key, hierarchy, this.hierarchyTtlMs)
  }

  async invalidateHierarchy(teamId: string): Promise<void> {
    await this.repo.delete(`hierarchy:${teamId}`)
  }

  async getSpaceConfig(teamId: string): Promise<CachedSpaceConfig | null> {
    const key = `spaceConfig:${teamId}`
    const result = await this.repo.get(key)
    if (!result) return null
    return result.value as CachedSpaceConfig
  }

  async setSpaceConfig(teamId: string, config: CachedSpaceConfig): Promise<void> {
    const key = `spaceConfig:${teamId}`
    await this.repo.set(key, config, this.spaceConfigTtlMs)
  }

  async invalidateSpaceConfig(teamId: string): Promise<void> {
    await this.repo.delete(`spaceConfig:${teamId}`)
  }
}
