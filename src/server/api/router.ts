import { Router, json } from "express"
import { ConnectionRepository } from "../../infrastructure/repositories/ConnectionRepository.js"
import { SessionRepository } from "../../infrastructure/repositories/SessionRepository.js"
import { AuthCodeRepository } from "../../infrastructure/repositories/AuthCodeRepository.js"
import { EncryptionService } from "../../application/security/EncryptionService.js"
import { PasswordService } from "../../application/security/PasswordService.js"
import { ConnectionManager } from "../../application/services/ConnectionManager.js"
import { SessionManager } from "../../application/services/SessionManager.js"
import { AuthService } from "../../application/services/AuthService.js"
import { resolveTeamIdFromApiKey } from "../teamResolution.js"

const router = Router()
router.use(json())

let connectionManager: ConnectionManager
let sessionManager: SessionManager
let authService: AuthService

try {
  if (process.env.MASTER_KEY) {
      const encryptionService = new EncryptionService()
      const passwordService = new PasswordService()
      const connectionRepository = new ConnectionRepository()
      const sessionRepository = new SessionRepository()
      const authCodeRepository = new AuthCodeRepository()
      connectionManager = new ConnectionManager(connectionRepository, encryptionService)
      sessionManager = new SessionManager(sessionRepository, connectionManager, passwordService)
      authService = new AuthService(authCodeRepository, sessionManager)
  } else {
    console.warn("MASTER_KEY not set. API endpoints will return 500.")
  }
} catch (err) {
  console.error("Service initialization failed:", err)
}

export { sessionManager }

// Middleware to ensure services are ready
const ensureServices = (req: any, res: any, next: any) => {
  if (!connectionManager || !sessionManager || !authService) {
    return res.status(500).json({ error: "Server not configured (Missing MASTER_KEY?)" })
  }
  next()
}

// Connections
router.get("/connections", ensureServices, async (req, res) => {
  try {
    const list = await connectionManager.list()
    const safeList = list.map((c: any) => ({ ...c, encryptedSecrets: undefined }))
    res.json(safeList)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.post("/connections", ensureServices, async (req, res) => {
  try {
    const input = req.body
    if (!input.name || !input.config || !input.config.apiKey) {
      res.status(400).json({ error: "Missing required fields" })
      return
    }

    if (!input.config.teamId) {
      try {
        input.config.teamId = await resolveTeamIdFromApiKey(input.config.apiKey)
      } catch (error) {
        res.status(400).json({ error: "Failed to resolve team ID: " + (error instanceof Error ? error.message : String(error)) })
        return
      }
    }

    const connection = await connectionManager.create(input)
    res.status(201).json({ ...connection, encryptedSecrets: undefined })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.get("/connections/:id", ensureServices, async (req, res) => {
  try {
    const connection = await connectionManager.get(req.params.id)
    if (!connection) {
      res.status(404).json({ error: "Not found" })
      return
    }
    res.json({ ...connection, encryptedSecrets: undefined })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.get("/connections/:id/sessions", ensureServices, async (req, res) => {
  try {
    const sessions = await sessionManager.listSessions(req.params.id)
    const safeSessions = sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        revoked: s.revoked
    }))
    res.json(safeSessions)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.delete("/connections/:id", ensureServices, async (req, res) => {
  try {
    await connectionManager.delete(req.params.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Sessions
router.post("/sessions", ensureServices, async (req, res) => {
  try {
    const { connectionId } = req.body
    if (!connectionId) {
      res.status(400).json({ error: "connectionId is required" })
      return
    }

    const result = await sessionManager.createSession(connectionId)
    res.status(201).json(result)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.post("/sessions/:id/revoke", ensureServices, async (req, res) => {
  try {
    await sessionManager.revokeSession(req.params.id)
    res.status(204).end()
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Auth
router.post("/auth/code", ensureServices, async (req, res) => {
  try {
    const { connectionId, redirectUri } = req.body
    if (!connectionId) {
      res.status(400).json({ error: "connectionId is required" })
      return
    }
    const code = await authService.generateCode(connectionId, redirectUri)
    res.json({ code })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

router.post("/auth/token", ensureServices, async (req, res) => {
  try {
    const { code } = req.body
    if (!code) {
      res.status(400).json({ error: "code is required" })
      return
    }

    // Support both snake_case (OAuth std) and camelCase
    const redirectUri = req.body.redirect_uri || req.body.redirectUri

    const accessToken = await authService.exchangeCode(code, redirectUri)
    res.json({ accessToken })
  } catch (err) {
    res.status(400).json({ error: (err as Error).message })
  }
})

export default router
