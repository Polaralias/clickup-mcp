CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris JSONB NOT NULL,
  token_endpoint_auth_method TEXT DEFAULT 'none',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  encrypted_secrets TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS auth_codes (
  code TEXT PRIMARY KEY,
  connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  redirect_uri TEXT,
  client_id TEXT REFERENCES clients(client_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_expires_at ON cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- Migrations for PKCE
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS code_challenge TEXT;
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS code_challenge_method TEXT;
ALTER TABLE auth_codes ADD COLUMN IF NOT EXISTS client_id TEXT REFERENCES clients(client_id) ON DELETE CASCADE;
