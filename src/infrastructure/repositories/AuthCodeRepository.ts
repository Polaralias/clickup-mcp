import { pool } from "../db/index.js"

export interface AuthCode {
  code: string
  connectionId: string
  expiresAt: Date
  redirectUri?: string
}

export class AuthCodeRepository {
  async create(authCode: AuthCode): Promise<void> {
    await pool.query(
      "INSERT INTO auth_codes (code, connection_id, expires_at, redirect_uri) VALUES ($1, $2, $3, $4)",
      [authCode.code, authCode.connectionId, authCode.expiresAt, authCode.redirectUri]
    )
  }

  async get(code: string): Promise<AuthCode | null> {
    const res = await pool.query("SELECT * FROM auth_codes WHERE code = $1", [code])
    if (res.rows.length === 0) return null
    const row = res.rows[0]
    return {
      code: row.code,
      connectionId: row.connection_id,
      expiresAt: row.expires_at,
      redirectUri: row.redirect_uri
    }
  }

  async delete(code: string): Promise<void> {
    await pool.query("DELETE FROM auth_codes WHERE code = $1", [code])
  }
}
