import { queryOne } from './_db.js';

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const CERT_TTL_MS = 60 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 300;

let certificateCache = { fetchedAt: 0, keys: [] };

function base64UrlToBytes(value) {
  const padded = value.length % 4 === 0 ? value : value + '='.repeat(4 - (value.length % 4));
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeSegment(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

async function getCertificates() {
  const now = Date.now();
  if (certificateCache.keys.length && now - certificateCache.fetchedAt < CERT_TTL_MS) {
    return certificateCache.keys;
  }
  const response = await fetch(GOOGLE_CERTS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!response.ok) {
    throw new Error(`No se pudieron obtener las claves públicas de Google (${response.status})`);
  }
  const data = await response.json();
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (!keys.length) throw new Error('Google no devolvió claves públicas');
  certificateCache = { fetchedAt: now, keys };
  return keys;
}

async function verifySignature(header, signingInput, signature) {
  const keys = await getCertificates();
  const jwk = keys.find((key) => key.kid === header.kid) || keys[0];
  if (!jwk) throw new Error('Clave pública de Google no encontrada');
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signature),
    new TextEncoder().encode(signingInput),
  );
  if (!valid) throw new Error('Firma del token inválida');
}

export async function verifyGoogleIdToken(env, idToken) {
  if (typeof idToken !== 'string' || !idToken) throw new Error('Token de identidad ausente');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Token de identidad malformado');
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = decodeSegment(headerSegment);
  const payload = decodeSegment(payloadSegment);
  if (header.alg !== 'RS256') throw new Error('Algoritmo de firma no permitido');

  await verifySignature(header, `${headerSegment}.${payloadSegment}`, signatureSegment);

  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error('Emisor del token no confiable');
  if (typeof payload.exp !== 'number' || payload.exp < now - CLOCK_SKEW_SECONDS) {
    throw new Error('Token expirado');
  }
  if (typeof payload.iat === 'number' && payload.iat > now + CLOCK_SKEW_SECONDS) {
    throw new Error('Token emitido en el futuro');
  }
  const expectedAudience = env && env.GOOGLE_CLIENT_ID;
  if (expectedAudience && payload.aud !== expectedAudience) {
    throw new Error('Audiencia (aud) del token inválida');
  }
  if (payload.email_verified === false) throw new Error('Correo de Google no verificado');
  if (!payload.email) throw new Error('Token sin correo electrónico');
  return payload;
}

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

export async function requireAdmin(request, env) {
  const token = bearerToken(request);
  if (!token) return { ok: false, status: 401, error: 'Falta el encabezado Authorization' };

  let payload;
  try {
    payload = await verifyGoogleIdToken(env, token);
  } catch (err) {
    return { ok: false, status: 401, error: err && err.message ? err.message : 'Token inválido' };
  }

  const email = String(payload.email).toLowerCase();
  let admin;
  try {
    admin = await queryOne(
      env,
      'SELECT id, email, nombre, rol, activo FROM admins WHERE email = ? AND activo = 1 LIMIT 1',
      [email],
    );
  } catch (err) {
    return { ok: false, status: 500, error: 'No se pudo verificar la cuenta administradora' };
  }
  if (!admin) return { ok: false, status: 403, error: 'La cuenta no tiene permisos de administrador' };

  return { ok: true, admin, identity: payload };
}

export async function requireRole(request, env, roles = []) {
  const result = await requireAdmin(request, env);
  if (!result.ok) return result;
  const role = String(result.admin.rol || 'admin');
  if (roles.length && !roles.includes(role)) {
    return { ok: false, status: 403, error: 'Rol insuficiente para esta operación' };
  }
  return result;
}
