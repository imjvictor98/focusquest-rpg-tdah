import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type SqlClient = NeonQueryFunction<false, false>;

let cachedClient: SqlClient | null = null;
let cachedConnectionString: string | null = null;
let schemaInitPromise: Promise<void> | null = null;

function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.NETLIFY_DATABASE_URL?.trim() ||
    '';

  if (!url) {
    throw new Error(
      'DATABASE_URL não configurada. Defina a variável DATABASE_URL no arquivo .env (local) ou nas Environment Variables da Netlify.'
    );
  }

  return url;
}

export function getSql(): SqlClient {
  const url = resolveDatabaseUrl();
  if (!cachedClient || cachedConnectionString !== url) {
    cachedClient = neon(url);
    cachedConnectionString = url;
    schemaInitPromise = null;
  }
  return cachedClient;
}

export async function ensureSchema(): Promise<SqlClient> {
  const sql = getSql();

  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS passkeys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          public_key TEXT NOT NULL,
          counter BIGINT NOT NULL DEFAULT 0,
          device_type TEXT NOT NULL DEFAULT 'singleDevice',
          backed_up BOOLEAN NOT NULL DEFAULT FALSE,
          transports TEXT[] NOT NULL DEFAULT '{}',
          aaguid TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON passkeys(user_id)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS webauthn_challenges (
          id TEXT PRIMARY KEY,
          challenge TEXT NOT NULL,
          type TEXT NOT NULL,
          user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
          payload JSONB,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires_at
          ON webauthn_challenges(expires_at)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_agent TEXT,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS game_states (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          state JSONB NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
    })().catch((err) => {
      schemaInitPromise = null;
      throw err;
    });
  }

  await schemaInitPromise;
  return sql;
}
