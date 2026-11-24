import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { AppState, AuthUser, PasskeyInfo } from '../types';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : `Erro na requisição (${res.status}).`;
    const code = typeof data.code === 'string' ? data.code : undefined;
    throw new ApiError(message, res.status, code);
  }

  return data as T;
}

export function getSuggestedDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Meu Dispositivo';
  const ua = navigator.userAgent;

  let os = 'Dispositivo';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';

  return browser ? `${os} · ${browser}` : os;
}

export function translateWebAuthnError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }

  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: unknown }).name)
      : '';
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message : '';

  if (
    name === 'NotAllowedError' ||
    name === 'AbortError' ||
    code === 'ERROR_CEREMONY_ABORTED'
  ) {
    return 'A verificação da Passkey foi cancelada ou expirou. Tente novamente quando estiver pronto.';
  }

  if (
    name === 'InvalidStateError' ||
    code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED'
  ) {
    return 'Este dispositivo ou chave já possui uma Passkey registrada para esta conta.';
  }

  if (name === 'NotSupportedError' || code === 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY') {
    return 'Este navegador ou dispositivo não suporta este tipo de Passkey.';
  }

  if (name === 'SecurityError') {
    return 'Passkeys exigem uma conexão segura (HTTPS ou localhost).';
  }

  return msg || 'Não foi possível concluir a autenticação com Passkey.';
}

export async function checkPasskeySupport(): Promise<{
  supported: boolean;
  platformAvailable: boolean;
}> {
  const supported = browserSupportsWebAuthn();
  if (!supported) {
    return { supported: false, platformAvailable: false };
  }
  try {
    const platformAvailable = await platformAuthenticatorIsAvailable();
    return { supported: true, platformAvailable };
  } catch {
    return { supported: true, platformAvailable: false };
  }
}

// ---------------------------------------------------------------------------
// Session & Auth API
// ---------------------------------------------------------------------------

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const data = await requestJson<{ authenticated: boolean; user: AuthUser | null }>('/auth/me');
  return data.authenticated ? data.user : null;
}

export async function logoutAccount(): Promise<void> {
  await requestJson('/auth/logout', { method: 'POST' });
}

export async function registerWithPasskey(params: {
  email: string;
  displayName: string;
  passkeyName: string;
  authenticatorAttachment?: 'platform' | 'cross-platform';
}): Promise<{ user: AuthUser; passkey: PasskeyInfo }> {
  const { challengeId, options } = await requestJson<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/auth/passkey/register/options', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  const attestationResponse = await startRegistration({ optionsJSON: options });

  return requestJson<{ user: AuthUser; passkey: PasskeyInfo }>(
    '/auth/passkey/register/verify',
    {
      method: 'POST',
      body: JSON.stringify({
        challengeId,
        passkeyName: params.passkeyName,
        response: attestationResponse,
      }),
    }
  );
}

export async function loginWithPasskey(email?: string): Promise<{ user: AuthUser }> {
  const { challengeId, options } = await requestJson<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>('/auth/passkey/login/options', {
    method: 'POST',
    body: JSON.stringify(email?.trim() ? { email: email.trim() } : {}),
  });

  const assertionResponse = await startAuthentication({ optionsJSON: options });

  return requestJson<{ user: AuthUser }>('/auth/passkey/login/verify', {
    method: 'POST',
    body: JSON.stringify({
      challengeId,
      response: assertionResponse,
    }),
  });
}

export async function registerWithPassword(params: {
  email: string;
  displayName: string;
  password: string;
}): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>('/auth/register-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function loginWithPassword(params: {
  email: string;
  password: string;
}): Promise<{ user: AuthUser }> {
  return requestJson<{ user: AuthUser }>('/auth/login-password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Account & Passkey Configuration API
// ---------------------------------------------------------------------------

export async function listPasskeys(): Promise<PasskeyInfo[]> {
  const data = await requestJson<{ passkeys: PasskeyInfo[] }>('/account/passkeys');
  return data.passkeys;
}

export async function addPasskeyToAccount(params: {
  passkeyName: string;
  authenticatorAttachment?: 'platform' | 'cross-platform';
}): Promise<{ passkey: PasskeyInfo; passkeysCount: number }> {
  const { challengeId, options } = await requestJson<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>('/account/passkeys/add/options', {
    method: 'POST',
    body: JSON.stringify(params),
  });

  const attestationResponse = await startRegistration({ optionsJSON: options });

  return requestJson<{ passkey: PasskeyInfo; passkeysCount: number }>(
    '/account/passkeys/add/verify',
    {
      method: 'POST',
      body: JSON.stringify({
        challengeId,
        passkeyName: params.passkeyName,
        response: attestationResponse,
      }),
    }
  );
}

export async function renamePasskey(id: string, name: string): Promise<PasskeyInfo> {
  const data = await requestJson<{ passkey: PasskeyInfo }>(
    `/account/passkeys/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }
  );
  return data.passkey;
}

export async function deletePasskey(id: string): Promise<{ passkeysCount: number }> {
  return requestJson<{ ok: boolean; passkeysCount: number }>(
    `/account/passkeys/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function updateProfile(displayName: string): Promise<AuthUser> {
  const data = await requestJson<{ user: AuthUser }>('/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  return data.user;
}

export async function setOrChangePassword(params: {
  currentPassword?: string;
  newPassword: string;
}): Promise<AuthUser> {
  const data = await requestJson<{ user: AuthUser }>('/account/password', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return data.user;
}

export async function removePassword(): Promise<AuthUser> {
  const data = await requestJson<{ user: AuthUser }>('/account/password', {
    method: 'DELETE',
  });
  return data.user;
}

// ---------------------------------------------------------------------------
// Cloud Game State API (Neon PostgreSQL)
// ---------------------------------------------------------------------------

export async function loadCloudGameState(): Promise<{
  state: AppState;
  version: number;
  updatedAt: string;
}> {
  return requestJson<{ state: AppState; version: number; updatedAt: string }>('/state');
}

export async function saveCloudGameState(
  state: AppState,
  keepalive = false
): Promise<{ ok: boolean; version: number; updatedAt: string }> {
  return requestJson<{ ok: boolean; version: number; updatedAt: string }>('/state', {
    method: 'PUT',
    body: JSON.stringify({ state }),
    keepalive,
  });
}
