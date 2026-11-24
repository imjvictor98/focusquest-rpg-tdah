import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { ensureSchema, type SqlClient } from './_lib/db';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  CHALLENGE_TTL_MS,
  generateId,
  generateToken,
  hashPassword,
  isSecureRequest,
  parseCookies,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sha256Hex,
  verifyPassword,
} from './_lib/crypto';
import { resolveRpConfig } from './_lib/rpConfig';
import {
  createServerInitialState,
  isValidAppState,
  normalizeAppState,
} from './_lib/seedState';

interface DbUserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  created_at: string;
  passkeys_count?: number | string;
}

interface DbPasskeyRow {
  id: string;
  user_id: string;
  name: string;
  public_key: string;
  counter: string | number;
  device_type: string;
  backed_up: boolean;
  transports: string[] | null;
  aaguid: string | null;
  created_at: string;
  last_used_at: string | null;
}

interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  hasPassword: boolean;
  passkeysCount: number;
  createdAt: string;
}

interface PublicPasskey {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(extraHeaders ?? {}),
    },
  });
}

function errorResponse(message: string, status = 400, code?: string): Response {
  return jsonResponse({ error: message, ...(code ? { code } : {}) }, status);
}

async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes = 1024 * 1024
): Promise<T> {
  const raw = await req.text();
  if (raw.length > maxBytes) {
    throw new HttpError(413, 'Payload muito grande.');
  }
  if (!raw.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'JSON inválido no corpo da requisição.');
  }
}

class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function validateEmail(email: string): void {
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    throw new HttpError(400, 'Informe um endereço de e-mail válido.');
  }
}

function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}

function validateDisplayName(name: string): void {
  if (name.length < 2 || name.length > 60) {
    throw new HttpError(400, 'O nome de herói deve ter entre 2 e 60 caracteres.');
  }
}

function normalizePasskeyName(raw: unknown, fallback = 'Minha Passkey'): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, 60);
}

function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 8) {
    throw new HttpError(400, 'A senha precisa ter pelo menos 8 caracteres.');
  }
  if (password.length > 128) {
    throw new HttpError(400, 'A senha pode ter no máximo 128 caracteres.');
  }
  return password;
}

function toPublicUser(row: DbUserRow, passkeysCount?: number): PublicUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    hasPassword: Boolean(row.password_hash),
    passkeysCount:
      typeof passkeysCount === 'number'
        ? passkeysCount
        : Number(row.passkeys_count ?? 0),
    createdAt: row.created_at,
  };
}

function toPublicPasskey(row: DbPasskeyRow): PublicPasskey {
  return {
    id: row.id,
    name: row.name,
    deviceType: row.device_type,
    backedUp: Boolean(row.backed_up),
    transports: Array.isArray(row.transports) ? row.transports : [],
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function normalizeApiPath(reqUrl: string): string {
  const url = new URL(reqUrl, 'http://localhost');
  let pathname = url.pathname;
  if (pathname.startsWith('/.netlify/functions/api')) {
    pathname = pathname.slice('/.netlify/functions/api'.length);
  } else if (pathname.startsWith('/api')) {
    pathname = pathname.slice('/api'.length);
  }
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return pathname;
}

async function cleanupExpired(sql: SqlClient): Promise<void> {
  try {
    await sql`DELETE FROM webauthn_challenges WHERE expires_at < NOW()`;
    await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
  } catch {
    // Non-critical housekeeping
  }
}

async function createSessionForUser(
  sql: SqlClient,
  userId: string,
  req: Request
): Promise<string> {
  const rawToken = generateToken(32);
  const tokenHash = sha256Hex(rawToken);
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 240);

  await sql`
    INSERT INTO sessions (id, token_hash, user_id, user_agent, expires_at)
    VALUES (${sessionId}, ${tokenHash}, ${userId}, ${userAgent}, ${expiresAt})
  `;

  return buildSessionCookie(rawToken, isSecureRequest(req));
}

async function getAuthenticatedUser(
  sql: SqlClient,
  req: Request
): Promise<{ user: DbUserRow; passkeysCount: number; sessionId: string } | null> {
  const cookies = parseCookies(req.headers.get('cookie'));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const tokenHash = sha256Hex(rawToken);
  const rows = (await sql`
    SELECT
      u.id,
      u.email,
      u.display_name,
      u.password_hash,
      u.created_at,
      s.id AS session_id,
      (SELECT COUNT(*)::int FROM passkeys p WHERE p.user_id = u.id) AS passkeys_count
    FROM sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
    LIMIT 1
  `) as Array<DbUserRow & { session_id: string }>;

  if (rows.length === 0) return null;

  const row = rows[0];
  // Update last_seen_at asynchronously without failing the request
  sql`UPDATE sessions SET last_seen_at = NOW() WHERE id = ${row.session_id}`.catch(() => {});

  return {
    user: row,
    passkeysCount: Number(row.passkeys_count ?? 0),
    sessionId: row.session_id,
  };
}

async function requireAuth(sql: SqlClient, req: Request) {
  const auth = await getAuthenticatedUser(sql, req);
  if (!auth) {
    throw new HttpError(401, 'Sessão expirada ou não autenticada. Faça login novamente.', 'UNAUTHORIZED');
  }
  return auth;
}

export async function handleApiRequest(req: Request): Promise<Response> {
  const method = req.method.toUpperCase();
  const path = normalizeApiPath(req.url);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  try {
    const sql = await ensureSchema();

    // -------------------------------------------------------------------------
    // Health Check
    // -------------------------------------------------------------------------
    if (method === 'GET' && path === '/health') {
      await sql`SELECT 1 AS ok`;
      return jsonResponse({ ok: true, database: 'connected' });
    }

    // -------------------------------------------------------------------------
    // Session: Me & Logout
    // -------------------------------------------------------------------------
    if (method === 'GET' && path === '/auth/me') {
      const auth = await getAuthenticatedUser(sql, req);
      if (!auth) {
        return jsonResponse({ authenticated: false, user: null });
      }
      return jsonResponse({
        authenticated: true,
        user: toPublicUser(auth.user, auth.passkeysCount),
      });
    }

    if (method === 'POST' && path === '/auth/logout') {
      const cookies = parseCookies(req.headers.get('cookie'));
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (rawToken) {
        const tokenHash = sha256Hex(rawToken);
        await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`;
      }
      return jsonResponse(
        { ok: true },
        200,
        { 'Set-Cookie': buildClearSessionCookie(isSecureRequest(req)) }
      );
    }

    // -------------------------------------------------------------------------
    // Passkey Sign Up (New Account)
    // -------------------------------------------------------------------------
    if (method === 'POST' && path === '/auth/passkey/register/options') {
      const body = await readJsonBody<{
        email?: string;
        displayName?: string;
        passkeyName?: string;
        authenticatorAttachment?: 'platform' | 'cross-platform';
      }>(req, 64 * 1024);

      const email = normalizeEmail(body.email);
      const displayName = normalizeDisplayName(body.displayName);
      const passkeyName = normalizePasskeyName(body.passkeyName, 'Passkey Principal');

      validateEmail(email);
      validateDisplayName(displayName);

      const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) {
        throw new HttpError(
          409,
          'Já existe uma conta com este e-mail. Use a aba "Entrar" para acessar.',
          'EMAIL_EXISTS'
        );
      }

      const rp = resolveRpConfig(req);
      const pendingUserId = generateId();

      const attachment =
        body.authenticatorAttachment === 'platform' ||
        body.authenticatorAttachment === 'cross-platform'
          ? body.authenticatorAttachment
          : undefined;

      const options = await generateRegistrationOptions({
        rpName: rp.rpName,
        rpID: rp.rpID,
        userID: new TextEncoder().encode(pendingUserId),
        userName: email,
        userDisplayName: displayName,
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'preferred',
          ...(attachment ? { authenticatorAttachment: attachment } : {}),
        },
      });

      const challengeId = generateToken(24);
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
      const payload = JSON.stringify({
        pendingUserId,
        email,
        displayName,
        passkeyName,
      });

      await sql`
        INSERT INTO webauthn_challenges (id, challenge, type, user_id, payload, expires_at)
        VALUES (${challengeId}, ${options.challenge}, 'register-signup', NULL, ${payload}::jsonb, ${expiresAt})
      `;

      // Opportunistic cleanup
      cleanupExpired(sql);

      return jsonResponse({ challengeId, options });
    }

    if (method === 'POST' && path === '/auth/passkey/register/verify') {
      const body = await readJsonBody<{
        challengeId?: string;
        passkeyName?: string;
        response?: RegistrationResponseJSON;
      }>(req, 64 * 1024);

      if (!body.challengeId || !body.response) {
        throw new HttpError(400, 'Dados de verificação da Passkey incompletos.');
      }

      const challengeRows = (await sql`
        DELETE FROM webauthn_challenges
        WHERE id = ${body.challengeId}
          AND type = 'register-signup'
          AND expires_at > NOW()
        RETURNING challenge, payload
      `) as Array<{
        challenge: string;
        payload: {
          pendingUserId: string;
          email: string;
          displayName: string;
          passkeyName: string;
        };
      }>;

      if (challengeRows.length === 0) {
        throw new HttpError(
          400,
          'O desafio de cadastro expirou ou já foi usado. Tente novamente.',
          'CHALLENGE_EXPIRED'
        );
      }

      const { challenge, payload } = challengeRows[0];
      const rp = resolveRpConfig(req);

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body.response,
          expectedChallenge: challenge,
          expectedOrigin: rp.expectedOrigins,
          expectedRPID: rp.rpID,
          requireUserVerification: false,
        });
      } catch (err) {
        console.error('Passkey signup verification failed:', err);
        throw new HttpError(400, 'Não foi possível validar a Passkey. Tente novamente.');
      }

      if (!verification.verified || !verification.registrationInfo) {
        throw new HttpError(400, 'Verificação da Passkey falhou.');
      }

      const {
        credential,
        credentialDeviceType,
        credentialBackedUp,
        aaguid,
      } = verification.registrationInfo;

      // Double check email uniqueness before insert
      const existing = await sql`SELECT id FROM users WHERE email = ${payload.email} LIMIT 1`;
      if (existing.length > 0) {
        throw new HttpError(409, 'Este e-mail já foi cadastrado. Tente fazer login.');
      }

      const userId = payload.pendingUserId;
      const passkeyName = normalizePasskeyName(
        body.passkeyName || payload.passkeyName,
        'Passkey Principal'
      );
      const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64url');
      const transports = credential.transports ?? body.response.response.transports ?? [];
      const initialState = createServerInitialState();

      const insertedUsers = (await sql`
        INSERT INTO users (id, email, display_name, password_hash)
        VALUES (${userId}, ${payload.email}, ${payload.displayName}, NULL)
        RETURNING id, email, display_name, password_hash, created_at
      `) as DbUserRow[];

      const insertedPasskeys = (await sql`
        INSERT INTO passkeys (
          id, user_id, name, public_key, counter, device_type, backed_up, transports, aaguid, last_used_at
        )
        VALUES (
          ${credential.id},
          ${userId},
          ${passkeyName},
          ${publicKeyB64},
          ${credential.counter},
          ${credentialDeviceType},
          ${credentialBackedUp},
          ${transports},
          ${aaguid || null},
          NOW()
        )
        RETURNING *
      `) as DbPasskeyRow[];

      await sql`
        INSERT INTO game_states (user_id, state, version)
        VALUES (${userId}, ${JSON.stringify(initialState)}::jsonb, 1)
      `;

      const sessionCookie = await createSessionForUser(sql, userId, req);

      return jsonResponse(
        {
          user: toPublicUser(insertedUsers[0], 1),
          passkey: toPublicPasskey(insertedPasskeys[0]),
        },
        201,
        { 'Set-Cookie': sessionCookie }
      );
    }

    // -------------------------------------------------------------------------
    // Passkey Login (Discoverable 1-click OR filtered by email)
    // -------------------------------------------------------------------------
    if (method === 'POST' && path === '/auth/passkey/login/options') {
      const body = await readJsonBody<{ email?: string }>(req, 32 * 1024);
      const email = normalizeEmail(body.email);
      const rp = resolveRpConfig(req);

      let allowCredentials: Array<{ id: string; transports?: string[] }> | undefined;
      let targetUserId: string | null = null;

      if (email) {
        validateEmail(email);
        const users = (await sql`
          SELECT id FROM users WHERE email = ${email} LIMIT 1
        `) as Array<{ id: string }>;

        if (users.length === 0) {
          throw new HttpError(
            404,
            'Nenhuma conta encontrada com este e-mail. Crie uma conta primeiro ou deixe o campo em branco para usar Passkey direta.'
          );
        }

        targetUserId = users[0].id;
        const passkeys = (await sql`
          SELECT id, transports FROM passkeys WHERE user_id = ${targetUserId}
        `) as Array<{ id: string; transports: string[] | null }>;

        if (passkeys.length === 0) {
          throw new HttpError(
            400,
            'Esta conta ainda não tem Passkey cadastrada. Entre com sua senha e configure uma Passkey nas configurações da conta.'
          );
        }

        allowCredentials = passkeys.map((p) => ({
          id: p.id,
          transports: Array.isArray(p.transports) ? p.transports : undefined,
        }));
      }

      const options = await generateAuthenticationOptions({
        rpID: rp.rpID,
        userVerification: 'preferred',
        ...(allowCredentials ? { allowCredentials } : {}),
      });

      const challengeId = generateToken(24);
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

      await sql`
        INSERT INTO webauthn_challenges (id, challenge, type, user_id, payload, expires_at)
        VALUES (${challengeId}, ${options.challenge}, 'authenticate', ${targetUserId}, NULL, ${expiresAt})
      `;

      cleanupExpired(sql);

      return jsonResponse({ challengeId, options });
    }

    if (method === 'POST' && path === '/auth/passkey/login/verify') {
      const body = await readJsonBody<{
        challengeId?: string;
        response?: AuthenticationResponseJSON;
      }>(req, 64 * 1024);

      if (!body.challengeId || !body.response) {
        throw new HttpError(400, 'Dados de autenticação da Passkey incompletos.');
      }

      const challengeRows = (await sql`
        DELETE FROM webauthn_challenges
        WHERE id = ${body.challengeId}
          AND type = 'authenticate'
          AND expires_at > NOW()
        RETURNING challenge, user_id
      `) as Array<{ challenge: string; user_id: string | null }>;

      if (challengeRows.length === 0) {
        throw new HttpError(
          400,
          'O desafio de login expirou ou já foi usado. Tente novamente.',
          'CHALLENGE_EXPIRED'
        );
      }

      const { challenge, user_id: expectedUserId } = challengeRows[0];
      const credentialId = body.response.id;

      const passkeyRows = (await sql`
        SELECT
          p.*,
          u.email,
          u.display_name,
          u.password_hash,
          u.created_at AS user_created_at,
          (SELECT COUNT(*)::int FROM passkeys p2 WHERE p2.user_id = u.id) AS passkeys_count
        FROM passkeys p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.id = ${credentialId}
        LIMIT 1
      `) as Array<
        DbPasskeyRow & {
          email: string;
          display_name: string;
          password_hash: string | null;
          user_created_at: string;
          passkeys_count: number;
        }
      >;

      if (passkeyRows.length === 0) {
        throw new HttpError(
          401,
          'Esta Passkey não está vinculada a nenhuma conta ativa no FocusQuest.'
        );
      }

      const row = passkeyRows[0];
      if (expectedUserId && row.user_id !== expectedUserId) {
        throw new HttpError(401, 'A Passkey selecionada não pertence a este e-mail.');
      }

      const rp = resolveRpConfig(req);
      let verification;
      try {
        verification = await verifyAuthenticationResponse({
          response: body.response,
          expectedChallenge: challenge,
          expectedOrigin: rp.expectedOrigins,
          expectedRPID: rp.rpID,
          requireUserVerification: false,
          credential: {
            id: row.id,
            publicKey: new Uint8Array(Buffer.from(row.public_key, 'base64url')),
            counter: Number(row.counter) || 0,
            transports: Array.isArray(row.transports) ? row.transports : undefined,
          },
        });
      } catch (err) {
        console.error('Passkey login verification failed:', err);
        throw new HttpError(401, 'Falha ao validar a assinatura da Passkey.');
      }

      if (!verification.verified) {
        throw new HttpError(401, 'Autenticação com Passkey rejeitada.');
      }

      const { newCounter, credentialBackedUp, credentialDeviceType } =
        verification.authenticationInfo;

      await sql`
        UPDATE passkeys
        SET
          counter = ${newCounter},
          backed_up = ${credentialBackedUp},
          device_type = ${credentialDeviceType},
          last_used_at = NOW()
        WHERE id = ${row.id}
      `;

      const sessionCookie = await createSessionForUser(sql, row.user_id, req);

      return jsonResponse(
        {
          user: {
            id: row.user_id,
            email: row.email,
            displayName: row.display_name,
            hasPassword: Boolean(row.password_hash),
            passkeysCount: Number(row.passkeys_count ?? 1),
            createdAt: row.user_created_at,
          } satisfies PublicUser,
        },
        200,
        { 'Set-Cookie': sessionCookie }
      );
    }

    // -------------------------------------------------------------------------
    // Fallback Email + Password Auth
    // -------------------------------------------------------------------------
    if (method === 'POST' && path === '/auth/register-password') {
      const body = await readJsonBody<{
        email?: string;
        displayName?: string;
        password?: string;
      }>(req, 32 * 1024);

      const email = normalizeEmail(body.email);
      const displayName = normalizeDisplayName(body.displayName);
      const password = validatePassword(body.password);

      validateEmail(email);
      validateDisplayName(displayName);

      const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) {
        throw new HttpError(
          409,
          'Já existe uma conta com este e-mail. Use a aba "Entrar".',
          'EMAIL_EXISTS'
        );
      }

      const userId = generateId();
      const passwordHash = hashPassword(password);
      const initialState = createServerInitialState();

      const insertedUsers = (await sql`
        INSERT INTO users (id, email, display_name, password_hash)
        VALUES (${userId}, ${email}, ${displayName}, ${passwordHash})
        RETURNING id, email, display_name, password_hash, created_at
      `) as DbUserRow[];

      await sql`
        INSERT INTO game_states (user_id, state, version)
        VALUES (${userId}, ${JSON.stringify(initialState)}::jsonb, 1)
      `;

      const sessionCookie = await createSessionForUser(sql, userId, req);

      return jsonResponse(
        { user: toPublicUser(insertedUsers[0], 0) },
        201,
        { 'Set-Cookie': sessionCookie }
      );
    }

    if (method === 'POST' && path === '/auth/login-password') {
      const body = await readJsonBody<{ email?: string; password?: string }>(req, 32 * 1024);
      const email = normalizeEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';

      validateEmail(email);
      if (!password) {
        throw new HttpError(400, 'Informe sua senha.');
      }

      const rows = (await sql`
        SELECT
          u.id,
          u.email,
          u.display_name,
          u.password_hash,
          u.created_at,
          (SELECT COUNT(*)::int FROM passkeys p WHERE p.user_id = u.id) AS passkeys_count
        FROM users u
        WHERE u.email = ${email}
        LIMIT 1
      `) as DbUserRow[];

      if (rows.length === 0) {
        throw new HttpError(401, 'E-mail ou senha inválidos.');
      }

      const user = rows[0];
      if (!user.password_hash) {
        throw new HttpError(
          401,
          'Esta conta usa login exclusivo com Passkey e não tem senha configurada. Clique em "Entrar com Passkey".'
        );
      }

      if (!verifyPassword(password, user.password_hash)) {
        throw new HttpError(401, 'E-mail ou senha inválidos.');
      }

      const sessionCookie = await createSessionForUser(sql, user.id, req);

      return jsonResponse(
        { user: toPublicUser(user) },
        200,
        { 'Set-Cookie': sessionCookie }
      );
    }

    // -------------------------------------------------------------------------
    // Account Passkey Management (Authenticated)
    // -------------------------------------------------------------------------
    if (method === 'GET' && path === '/account/passkeys') {
      const { user } = await requireAuth(sql, req);
      const rows = (await sql`
        SELECT * FROM passkeys
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `) as DbPasskeyRow[];

      return jsonResponse({
        passkeys: rows.map(toPublicPasskey),
      });
    }

    if (method === 'POST' && path === '/account/passkeys/add/options') {
      const { user } = await requireAuth(sql, req);
      const body = await readJsonBody<{
        passkeyName?: string;
        authenticatorAttachment?: 'platform' | 'cross-platform';
      }>(req, 32 * 1024);

      const passkeyName = normalizePasskeyName(body.passkeyName, 'Nova Passkey');
      const existingPasskeys = (await sql`
        SELECT id, transports FROM passkeys WHERE user_id = ${user.id}
      `) as Array<{ id: string; transports: string[] | null }>;

      const rp = resolveRpConfig(req);
      const attachment =
        body.authenticatorAttachment === 'platform' ||
        body.authenticatorAttachment === 'cross-platform'
          ? body.authenticatorAttachment
          : undefined;

      const options = await generateRegistrationOptions({
        rpName: rp.rpName,
        rpID: rp.rpID,
        userID: new TextEncoder().encode(user.id),
        userName: user.email,
        userDisplayName: user.display_name,
        attestationType: 'none',
        excludeCredentials: existingPasskeys.map((p) => ({
          id: p.id,
          transports: Array.isArray(p.transports) ? p.transports : undefined,
        })),
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'preferred',
          ...(attachment ? { authenticatorAttachment: attachment } : {}),
        },
      });

      const challengeId = generateToken(24);
      const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();

      await sql`
        INSERT INTO webauthn_challenges (id, challenge, type, user_id, payload, expires_at)
        VALUES (
          ${challengeId},
          ${options.challenge},
          'register-add',
          ${user.id},
          ${JSON.stringify({ passkeyName })}::jsonb,
          ${expiresAt}
        )
      `;

      return jsonResponse({ challengeId, options });
    }

    if (method === 'POST' && path === '/account/passkeys/add/verify') {
      const { user } = await requireAuth(sql, req);
      const body = await readJsonBody<{
        challengeId?: string;
        passkeyName?: string;
        response?: RegistrationResponseJSON;
      }>(req, 64 * 1024);

      if (!body.challengeId || !body.response) {
        throw new HttpError(400, 'Dados de verificação da Passkey incompletos.');
      }

      const challengeRows = (await sql`
        DELETE FROM webauthn_challenges
        WHERE id = ${body.challengeId}
          AND type = 'register-add'
          AND user_id = ${user.id}
          AND expires_at > NOW()
        RETURNING challenge, payload
      `) as Array<{ challenge: string; payload: { passkeyName?: string } | null }>;

      if (challengeRows.length === 0) {
        throw new HttpError(400, 'O desafio expirou ou já foi usado. Tente novamente.');
      }

      const { challenge, payload } = challengeRows[0];
      const rp = resolveRpConfig(req);

      let verification;
      try {
        verification = await verifyRegistrationResponse({
          response: body.response,
          expectedChallenge: challenge,
          expectedOrigin: rp.expectedOrigins,
          expectedRPID: rp.rpID,
          requireUserVerification: false,
        });
      } catch (err) {
        console.error('Add passkey verification failed:', err);
        throw new HttpError(400, 'Não foi possível validar a nova Passkey.');
      }

      if (!verification.verified || !verification.registrationInfo) {
        throw new HttpError(400, 'Verificação da nova Passkey falhou.');
      }

      const {
        credential,
        credentialDeviceType,
        credentialBackedUp,
        aaguid,
      } = verification.registrationInfo;

      const existingCred = await sql`SELECT id FROM passkeys WHERE id = ${credential.id} LIMIT 1`;
      if (existingCred.length > 0) {
        throw new HttpError(409, 'Esta Passkey já está registrada.');
      }

      const passkeyName = normalizePasskeyName(
        body.passkeyName || payload?.passkeyName,
        'Nova Passkey'
      );
      const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64url');
      const transports = credential.transports ?? body.response.response.transports ?? [];

      const inserted = (await sql`
        INSERT INTO passkeys (
          id, user_id, name, public_key, counter, device_type, backed_up, transports, aaguid
        )
        VALUES (
          ${credential.id},
          ${user.id},
          ${passkeyName},
          ${publicKeyB64},
          ${credential.counter},
          ${credentialDeviceType},
          ${credentialBackedUp},
          ${transports},
          ${aaguid || null}
        )
        RETURNING *
      `) as DbPasskeyRow[];

      const countRows = (await sql`
        SELECT COUNT(*)::int AS count FROM passkeys WHERE user_id = ${user.id}
      `) as Array<{ count: number }>;

      return jsonResponse(
        {
          passkey: toPublicPasskey(inserted[0]),
          passkeysCount: Number(countRows[0]?.count ?? 1),
        },
        201
      );
    }

    const passkeyItemMatch = path.match(/^\/account\/passkeys\/([^/]+)$/);
    if (passkeyItemMatch) {
      const { user } = await requireAuth(sql, req);
      const passkeyId = decodeURIComponent(passkeyItemMatch[1]);

      if (method === 'PATCH') {
        const body = await readJsonBody<{ name?: string }>(req, 16 * 1024);
        const name = normalizePasskeyName(body.name, '');
        if (!name) {
          throw new HttpError(400, 'Informe um nome válido para a Passkey.');
        }

        const updated = (await sql`
          UPDATE passkeys
          SET name = ${name}
          WHERE id = ${passkeyId} AND user_id = ${user.id}
          RETURNING *
        `) as DbPasskeyRow[];

        if (updated.length === 0) {
          throw new HttpError(404, 'Passkey não encontrada.');
        }

        return jsonResponse({ passkey: toPublicPasskey(updated[0]) });
      }

      if (method === 'DELETE') {
        const countRows = (await sql`
          SELECT COUNT(*)::int AS count FROM passkeys WHERE user_id = ${user.id}
        `) as Array<{ count: number }>;
        const totalPasskeys = Number(countRows[0]?.count ?? 0);
        const hasPassword = Boolean(user.password_hash);

        if (totalPasskeys <= 1 && !hasPassword) {
          throw new HttpError(
            400,
            'Você não pode remover sua única Passkey sem ter uma senha de recuperação configurada. Adicione outra Passkey ou defina uma senha primeiro.'
          );
        }

        const deleted = (await sql`
          DELETE FROM passkeys
          WHERE id = ${passkeyId} AND user_id = ${user.id}
          RETURNING id
        `) as Array<{ id: string }>;

        if (deleted.length === 0) {
          throw new HttpError(404, 'Passkey não encontrada.');
        }

        return jsonResponse({
          ok: true,
          passkeysCount: Math.max(0, totalPasskeys - 1),
        });
      }
    }

    // -------------------------------------------------------------------------
    // Account Profile & Fallback Password Management (Authenticated)
    // -------------------------------------------------------------------------
    if (method === 'PATCH' && path === '/account/profile') {
      const { user, passkeysCount } = await requireAuth(sql, req);
      const body = await readJsonBody<{ displayName?: string }>(req, 16 * 1024);
      const displayName = normalizeDisplayName(body.displayName);
      validateDisplayName(displayName);

      const updated = (await sql`
        UPDATE users
        SET display_name = ${displayName}, updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, email, display_name, password_hash, created_at
      `) as DbUserRow[];

      return jsonResponse({
        user: toPublicUser(updated[0], passkeysCount),
      });
    }

    if (method === 'POST' && path === '/account/password') {
      const { user, passkeysCount } = await requireAuth(sql, req);
      const body = await readJsonBody<{
        currentPassword?: string;
        newPassword?: string;
      }>(req, 16 * 1024);

      const newPassword = validatePassword(body.newPassword);

      if (user.password_hash) {
        if (!body.currentPassword || !verifyPassword(body.currentPassword, user.password_hash)) {
          throw new HttpError(401, 'A senha atual informada está incorreta.');
        }
      }

      const newHash = hashPassword(newPassword);
      const updated = (await sql`
        UPDATE users
        SET password_hash = ${newHash}, updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, email, display_name, password_hash, created_at
      `) as DbUserRow[];

      return jsonResponse({
        user: toPublicUser(updated[0], passkeysCount),
      });
    }

    if (method === 'DELETE' && path === '/account/password') {
      const { user, passkeysCount } = await requireAuth(sql, req);
      if (passkeysCount < 1) {
        throw new HttpError(
          400,
          'Configure pelo menos uma Passkey antes de remover sua senha de recuperação.'
        );
      }

      const updated = (await sql`
        UPDATE users
        SET password_hash = NULL, updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, email, display_name, password_hash, created_at
      `) as DbUserRow[];

      return jsonResponse({
        user: toPublicUser(updated[0], passkeysCount),
      });
    }

    // -------------------------------------------------------------------------
    // Game State Persistence (Neon PostgreSQL - replaces localStorage)
    // -------------------------------------------------------------------------
    if (method === 'GET' && path === '/state') {
      const { user } = await requireAuth(sql, req);

      const rows = (await sql`
        SELECT state, version, updated_at
        FROM game_states
        WHERE user_id = ${user.id}
        LIMIT 1
      `) as Array<{ state: unknown; version: number; updated_at: string }>;

      if (rows.length === 0 || !isValidAppState(rows[0].state)) {
        const seed = createServerInitialState();
        const inserted = (await sql`
          INSERT INTO game_states (user_id, state, version)
          VALUES (${user.id}, ${JSON.stringify(seed)}::jsonb, 1)
          ON CONFLICT (user_id) DO UPDATE
          SET state = EXCLUDED.state, version = game_states.version + 1, updated_at = NOW()
          RETURNING version, updated_at
        `) as Array<{ version: number; updated_at: string }>;

        return jsonResponse({
          state: seed,
          version: inserted[0]?.version ?? 1,
          updatedAt: inserted[0]?.updated_at ?? new Date().toISOString(),
        });
      }

      const normalized = normalizeAppState(rows[0].state);
      return jsonResponse({
        state: normalized,
        version: rows[0].version,
        updatedAt: rows[0].updated_at,
      });
    }

    if (method === 'PUT' && path === '/state') {
      const { user } = await requireAuth(sql, req);
      const body = await readJsonBody<{ state?: unknown }>(req, 1024 * 1024);

      if (!isValidAppState(body.state)) {
        throw new HttpError(400, 'Estado do jogo inválido.');
      }

      const normalized = normalizeAppState(body.state);
      const saved = (await sql`
        INSERT INTO game_states (user_id, state, version, updated_at)
        VALUES (${user.id}, ${JSON.stringify(normalized)}::jsonb, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
          state = EXCLUDED.state,
          version = game_states.version + 1,
          updated_at = NOW()
        RETURNING version, updated_at
      `) as Array<{ version: number; updated_at: string }>;

      return jsonResponse({
        ok: true,
        version: saved[0]?.version ?? 1,
        updatedAt: saved[0]?.updated_at ?? new Date().toISOString(),
      });
    }

    return errorResponse('Rota da API não encontrada.', 404, 'NOT_FOUND');
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.message, err.status, err.code);
    }

    const message = err instanceof Error ? err.message : 'Erro interno no servidor.';
    console.error('[API Error]', path, err);

    if (message.includes('DATABASE_URL não configurada')) {
      return errorResponse(message, 503, 'DB_NOT_CONFIGURED');
    }

    return errorResponse(
      'Erro interno ao processar a solicitação. Verifique a conexão com o banco de dados.',
      500,
      'INTERNAL_ERROR'
    );
  }
}

export default async function handler(req: Request): Promise<Response> {
  return handleApiRequest(req);
}
