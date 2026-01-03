import { pool } from "../db/index.js"

export interface Client {
    clientId: string
    clientName?: string
    redirectUris: string[]
    tokenEndpointAuthMethod: string
    createdAt: Date
}

export class ClientRepository {
    async create(client: Omit<Client, "createdAt">): Promise<void> {
        await pool.query(
            "INSERT INTO clients (client_id, client_name, redirect_uris, token_endpoint_auth_method) VALUES ($1, $2, $3, $4)",
            [
                client.clientId,
                client.clientName,
                JSON.stringify(client.redirectUris),
                client.tokenEndpointAuthMethod
            ]
        )
    }

    async get(clientId: string): Promise<Client | null> {
        const res = await pool.query("SELECT * FROM clients WHERE client_id = $1", [clientId])
        if (res.rows.length === 0) return null
        const row = res.rows[0]
        return {
            clientId: row.client_id,
            clientName: row.client_name,
            redirectUris: row.redirect_uris as string[],
            tokenEndpointAuthMethod: row.token_endpoint_auth_method,
            createdAt: row.created_at
        }
    }

    async delete(clientId: string): Promise<void> {
        await pool.query("DELETE FROM clients WHERE client_id = $1", [clientId])
    }
}
