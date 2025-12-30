import { randomBytes } from "node:crypto"
import { AuthCodeRepository } from "../../infrastructure/repositories/AuthCodeRepository.js"
import { SessionManager } from "./SessionManager.js"

export class AuthService {
  constructor(
    private authCodeRepo: AuthCodeRepository,
    private sessionManager: SessionManager
  ) {}

  async generateCode(connectionId: string, redirectUri?: string): Promise<string> {
    const code = randomBytes(16).toString("hex") // 32 chars
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    await this.authCodeRepo.create({
      code,
      connectionId,
      expiresAt,
      redirectUri
    })

    return code
  }

  async exchangeCode(code: string, redirectUri?: string): Promise<string> {
    const authCode = await this.authCodeRepo.get(code)

    if (!authCode) {
      throw new Error("Invalid authorization code")
    }

    if (authCode.expiresAt < new Date()) {
      await this.authCodeRepo.delete(code)
      throw new Error("Authorization code expired")
    }

    // Verify redirectUri if one was associated with the code
    if (authCode.redirectUri) {
        if (!redirectUri) {
            throw new Error("Missing redirect_uri")
        }
        if (authCode.redirectUri !== redirectUri) {
            throw new Error("Invalid redirect_uri")
        }
    }

    // One-time use: delete immediately
    await this.authCodeRepo.delete(code)

    // Create session
    const { accessToken } = await this.sessionManager.createSession(authCode.connectionId)
    return accessToken
  }
}
