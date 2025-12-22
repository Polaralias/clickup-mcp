# Local Deployment Design Document

## 1. Inventory of Current MCP Servers and Transports

| Server | Transport | Auth | Config Inputs | Session Isolation | Caching |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ClickUp MCP** | HTTP (`/mcp`) | Bearer Token (Internal) <br> API Key (ClickUp) | `teamId`, `apiKey`, `charLimit`, `maxAttachmentMb`, `readOnly`, `selectiveWrite` | **Partial**: `httpTransport.ts` creates per-request `McpServer` instances. Config is currently per-request (via Query/Headers). | In-memory `SessionCache`. |

*   **Existing Entrypoint**: `/mcp` (Streamable HTTP).
*   **Session Support**: `httpTransport.ts` has `ensureSession` logic and maintains an in-memory `sessions` map.
*   **Missing**: Persistence, decoupled configuration (currently passed in request), secure storage of secrets.

## 2. Session Model

We will formalize the session model to support persistence and decoupled configuration.

### Session Object
```json
{
  "id": "uuid-v4",
  "connectionId": "uuid-v4", // Reference to Connection Profile
  "tokenHash": "string", // Argon2/Bcrypt hash of the session access token
  "createdAt": "timestamp",
  "expiresAt": "timestamp",
  "revoked": false
}
```

### Connection Profile
```json
{
  "id": "uuid-v4",
  "name": "My Personal ClickUp",
  "config": {
    "teamId": "12345",
    // Secrets like apiKey are NOT stored here in plaintext
  },
  "auth": {
    "type": "apiKey",
    "encryptedSecret": "..." // Envelope encrypted
  }
}
```

### Lifecycle
1.  **Creation**: User creates a Connection Profile via UI.
2.  **Connect**: User clicks "Connect" -> Backend creates a Session -> Returns `accessToken`.
3.  **Usage**: Client sends `Authorization: Bearer <accessToken>`.
4.  **Validation**: Backend hashes token, looks up Session, checks expiry/revocation.
5.  **Resolution**: Backend loads Connection Profile, decrypts secrets, initializes `McpServer`.
6.  **Expiry/Revocation**: Sessions can be revoked or expire.

## 3. Persistence Store Selection

**Choice: Postgres**

We will use Postgres for all persistence needs to minimize moving parts in the local `docker-compose` setup.

*   **Structured Data**: Connection Profiles, Sessions.
*   **Caching**: A `cache` table with `key`, `value` (JSON), and `expires_at`.

### Schema (Proposed)

```sql
CREATE TABLE connections (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL, -- Non-sensitive config
  encrypted_secrets TEXT NOT NULL, -- Encrypted JSON blob for secrets (apiKey)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE TABLE cache (
  key TEXT PRIMARY KEY, -- connection_id + tool + params
  value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
```

## 4. Security and Threat Model

### Threats & Mitigations

*   **Session Fixation/Leakage**:
    *   **Mitigation**: Generate random high-entropy tokens. Hash them in DB. Send via `Authorization` header.
*   **Secret Leakage**:
    *   **Mitigation**: **Envelope Encryption**.
        *   Master Key (`MASTER_KEY` env var) encrypts a Data Encryption Key (DEK).
        *   DEK encrypts the secrets.
        *   Or simply: Master Key encrypts the secrets directly (Simpler for local deployment).
        *   We will use `AES-256-GCM`.
*   **CSRF**:
    *   **Mitigation**: The UI will use a separate authentication mechanism (e.g., cookie) if needed, or just rely on local access. For the MCP client, `Bearer` tokens are immune to CSRF (as they require JS to send).
*   **SSRF**:
    *   **Mitigation**: Validate `teamId` and inputs. The server mostly talks to ClickUp API.
*   **Least Privilege**:
    *   **Mitigation**: Docker container runs as non-root user.

### Security Checklist
- [ ] Secrets encrypted at rest.
- [ ] Session tokens hashed.
- [ ] `MASTER_KEY` required in env.
- [ ] No secrets in logs.
- [ ] Rate limiting on auth endpoints.
