import { randomUUID } from "node:crypto"
import { ConnectionRepository } from "../../infrastructure/repositories/ConnectionRepository.js"
import { EncryptionService } from "../security/EncryptionService.js"
import type { ConnectionProfile } from "../types.js"

export type CreateConnectionInput = {
  name: string
  config: {
    teamId: string
    apiKey: string
    [key: string]: any
  }
}

export class ConnectionManager {
  constructor(
    private repo: ConnectionRepository,
    private encryption: EncryptionService
  ) {}

  async create(input: CreateConnectionInput): Promise<ConnectionProfile> {
    const { apiKey, ...publicConfig } = input.config

    if (!apiKey) throw new Error("apiKey is required")

    const encryptedSecrets = this.encryption.encrypt(JSON.stringify({ apiKey }))

    const connection: ConnectionProfile = {
      id: randomUUID(),
      name: input.name,
      config: publicConfig,
      encryptedSecrets,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await this.repo.create(connection)
    return connection
  }

  async get(id: string): Promise<ConnectionProfile | null> {
    return this.repo.getById(id)
  }

  async list(): Promise<ConnectionProfile[]> {
    return this.repo.list()
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id)
  }

  async getSecrets(connection: ConnectionProfile): Promise<{ apiKey: string }> {
    const decrypted = this.encryption.decrypt(connection.encryptedSecrets)
    return JSON.parse(decrypted)
  }
}
