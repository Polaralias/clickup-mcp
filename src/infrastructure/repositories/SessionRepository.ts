import { pool } from "../db/index.js"
import type { Session } from "../../application/types.js"

export class SessionRepository {
  async create(session: Session): Promise<void> {
    await pool.query(
      `INSERT INTO sessions (id, connection_id, token_hash, created_at, expires_at, revoked)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [session.id, session.connectionId, session.tokenHash, session.createdAt, session.expiresAt, session.revoked]
    )
  }

  async getById(id: string): Promise<Session | null> {
    const res = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [id])
    if (res.rows.length === 0) return null
    const row = res.rows[0]
    return {
      id: row.id,
      connectionId: row.connection_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revoked: row.revoked
    }
  }

  async revoke(id: string): Promise<void> {
    await pool.query(`UPDATE sessions SET revoked = TRUE WHERE id = $1`, [id])
  }

  async listByConnectionId(connectionId: string): Promise<Session[]> {
    const res = await pool.query(
      `SELECT * FROM sessions WHERE connection_id = $1 ORDER BY created_at DESC`,
      [connectionId]
    )
    return res.rows.map(row => ({
      id: row.id,
      connectionId: row.connection_id,
      tokenHash: row.token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revoked: row.revoked
    }))
  }
}
