import { randomUUID, randomBytes } from "node:crypto"
import { SessionRepository } from "../../infrastructure/repositories/SessionRepository.js"
import { PasswordService } from "../security/PasswordService.js"
import { ConnectionManager } from "./ConnectionManager.js"
import type { Session } from "../types.js"

export class SessionManager {
  constructor(
    private sessionRepo: SessionRepository,
    private connectionManager: ConnectionManager,
    private passwordService: PasswordService
  ) {}

  async createSession(connectionId: string): Promise<{ session: Session, accessToken: string }> {
    const connection = await this.connectionManager.get(connectionId)
    if (!connection) {
      throw new Error("Connection not found")
    }

    const sessionId = randomUUID()
    const secret = randomBytes(32).toString("hex") // 64 chars
    const accessToken = `${sessionId}:${secret}`

    // Hash the secret
    const tokenHash = await this.passwordService.hash(secret)

    const session: Session = {
      id: sessionId,
      connectionId,
      tokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      revoked: false
    }

    await this.sessionRepo.create(session)
    return { session, accessToken }
  }

  async validateSession(accessToken: string): Promise<{ session: Session, config: any } | null> {
    const parts = accessToken.split(":")
    if (parts.length !== 2) return null
    const [sessionId, secret] = parts

    const session = await this.sessionRepo.getById(sessionId)
    if (!session) return null
    if (session.revoked) return null
    if (session.expiresAt < new Date()) return null

    const isValid = await this.passwordService.verify(secret, session.tokenHash)
    if (!isValid) return null

    const connection = await this.connectionManager.get(session.connectionId)
    if (!connection) return null

    const secrets = await this.connectionManager.getSecrets(connection)
    const fullConfig = { ...connection.config, ...secrets }

    return { session, config: fullConfig }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepo.revoke(sessionId)
  }

  async listSessions(connectionId: string): Promise<Session[]> {
    return this.sessionRepo.listByConnectionId(connectionId)
  }
}
