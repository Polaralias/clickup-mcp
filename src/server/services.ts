import { ConnectionRepository } from "../infrastructure/repositories/ConnectionRepository.js"
import { SessionRepository } from "../infrastructure/repositories/SessionRepository.js"
import { AuthCodeRepository } from "../infrastructure/repositories/AuthCodeRepository.js"
import { EncryptionService } from "../application/security/EncryptionService.js"
import { PasswordService } from "../application/security/PasswordService.js"
import { getMasterKeyBytes } from "../application/security/masterKey.js"
import { ConnectionManager } from "../application/services/ConnectionManager.js"
import { SessionManager } from "../application/services/SessionManager.js"
import { AuthService } from "../application/services/AuthService.js"

export let connectionManager: ConnectionManager
export let sessionManager: SessionManager
export let authService: AuthService

export function initializeServices() {
  try {
    const encryptionService = new EncryptionService()
    const passwordService = new PasswordService()
    const connectionRepository = new ConnectionRepository()
    const sessionRepository = new SessionRepository()
    const authCodeRepository = new AuthCodeRepository()
    connectionManager = new ConnectionManager(connectionRepository, encryptionService)
    sessionManager = new SessionManager(sessionRepository, connectionManager, passwordService)
    authService = new AuthService(authCodeRepository, sessionManager)
  } catch (err) {
    console.error("Service initialization failed:", err)
    throw err // Ensure we fail fast during startup
  }
}

export function ensureServices(req: any, res: any, next: any) {
  if (!connectionManager || !sessionManager || !authService) {
    return res.status(500).json({ error: "Server not configured (Missing MASTER_KEY?)" })
  }
  next()
}
