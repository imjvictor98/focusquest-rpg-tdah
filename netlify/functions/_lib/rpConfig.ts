export interface RelyingPartyConfig {
  rpName: string;
  rpID: string;
  expectedOrigins: string[];
}

/**
 * Resolves WebAuthn Relying Party config (rpName, rpID, expectedOrigins).
 *
 * Uses explicit env vars when provided (recommended in production):
 *   - RP_NAME
 *   - RP_ID
 *   - RP_ORIGIN (supports comma-separated origins for deploy previews)
 *
 * Falls back safely to the request host/protocol so both localhost development
 * and Netlify production / deploy previews work out-of-the-box.
 */
export function resolveRpConfig(req: Request): RelyingPartyConfig {
  const rpName = process.env.RP_NAME?.trim() || 'FocusQuest RPG';

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const hostHeader = forwardedHost || req.headers.get('host')?.trim();
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();

  let fallbackOrigin = 'http://localhost:5173';
  let fallbackRpId = 'localhost';

  try {
    const parsedUrl = new URL(req.url);
    const proto = forwardedProto || parsedUrl.protocol.replace(':', '') || 'http';
    const host = hostHeader || parsedUrl.host;
    fallbackOrigin = `${proto}://${host}`;
    fallbackRpId = host.split(':')[0];
  } catch {
    if (hostHeader) {
      const proto = forwardedProto || (hostHeader.startsWith('localhost') ? 'http' : 'https');
      fallbackOrigin = `${proto}://${hostHeader}`;
      fallbackRpId = hostHeader.split(':')[0];
    }
  }

  const envRpId = process.env.RP_ID?.trim();
  const envOrigins = process.env.RP_ORIGIN?.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const rpID = envRpId || fallbackRpId;
  const expectedOrigins =
    envOrigins && envOrigins.length > 0 ? envOrigins : [fallbackOrigin.replace(/\/+$/, '')];

  return {
    rpName,
    rpID,
    expectedOrigins,
  };
}
