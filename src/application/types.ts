export type ConnectionProfile = {
  id: string
  name: string
  config: Record<string, any>
  encryptedSecrets: string
  createdAt: Date
  updatedAt: Date
}

export type Session = {
  id: string
  connectionId: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
  revoked: boolean
}
