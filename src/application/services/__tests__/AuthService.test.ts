import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../AuthService.js'
import { AuthCodeRepository } from '../../../infrastructure/repositories/AuthCodeRepository.js'
import { SessionManager } from '../SessionManager.js'

describe('AuthService', () => {
  let authService: AuthService
  let authCodeRepo: AuthCodeRepository
  let sessionManager: SessionManager

  beforeEach(() => {
    authCodeRepo = {
      create: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    } as unknown as AuthCodeRepository

    sessionManager = {
      createSession: vi.fn(),
    } as unknown as SessionManager

    authService = new AuthService(authCodeRepo, sessionManager)
  })

  it('generates a code and stores it', async () => {
    const code = await authService.generateCode('conn-1')
    expect(code).toBeTruthy()
    expect(authCodeRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      code,
      connectionId: 'conn-1'
    }))
  })

  it('exchanges a valid code for a token', async () => {
    const code = 'valid-code'
    const expiresAt = new Date(Date.now() + 10000)

    vi.mocked(authCodeRepo.get).mockResolvedValue({
      code,
      connectionId: 'conn-1',
      expiresAt
    })

    vi.mocked(sessionManager.createSession).mockResolvedValue({
        session: {} as any,
        accessToken: 'token-123'
    })

    const token = await authService.exchangeCode(code)

    expect(token).toBe('token-123')
    expect(authCodeRepo.delete).toHaveBeenCalledWith(code)
    expect(sessionManager.createSession).toHaveBeenCalledWith('conn-1')
  })

  it('rejects expired codes', async () => {
    const code = 'expired-code'
    const expiresAt = new Date(Date.now() - 10000)

    vi.mocked(authCodeRepo.get).mockResolvedValue({
      code,
      connectionId: 'conn-1',
      expiresAt
    })

    await expect(authService.exchangeCode(code)).rejects.toThrow('Authorization code expired')
    expect(authCodeRepo.delete).toHaveBeenCalledWith(code)
    expect(sessionManager.createSession).not.toHaveBeenCalled()
  })

  it('rejects invalid codes', async () => {
    vi.mocked(authCodeRepo.get).mockResolvedValue(null)

    await expect(authService.exchangeCode('invalid')).rejects.toThrow('Invalid authorization code')
  })
})
