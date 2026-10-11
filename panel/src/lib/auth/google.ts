const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];
const CERT_TTL_MS = 60 * 60 * 1000;

export const DEFAULT_GOOGLE_CLIENT_ID =
  "39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com";

export const googleClientId =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;

let certCache: { fetchedAt: number; keys: unknown[] } = { fetchedAt: 0, keys: [] };

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.length % 4 === 0 ? value : value + "=".repeat(4 - (value.length % 4));
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

async function getCertificates(): Promise<Record<string, string>[]> {
  const now = Date.now();
  if (certCache.keys.length && now - certCache.fetchedAt < CERT_TTL_MS) {
    return certCache.keys as Record<string, string>[];
  }
  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) throw new Error("No se pudieron obtener las claves de Google");
  const data = (await response.json()) as { keys?: Record<string, string>[] };
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (!keys.length) throw new Error("Google no devolvió claves");
  certCache = { fetchedAt: now, keys };
  return keys;
}

export type GoogleIdentity = { email: string; email_verified?: boolean; name?: string };

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Token malformado");
  const [headerSeg, payloadSeg, signatureSeg] = parts;

  const header = decodeSegment<{ alg: string; kid: string }>(headerSeg);
  const payload = decodeSegment<GoogleIdentity & { iss: string; aud: string; exp: number; iat?: number }>(
    payloadSeg,
  );
  if (header.alg !== "RS256") throw new Error("Algoritmo no permitido");

  const keys = await getCertificates();
  const jwk = keys.find((key) => key.kid === header.kid) ?? keys[0];
  if (!jwk) throw new Error("Clave pública no encontrada");

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlToBytes(signatureSeg) as unknown as BufferSource,
    new TextEncoder().encode(`${headerSeg}.${payloadSeg}`),
  );
  if (!valid) throw new Error("Firma inválida");

  const now = Math.floor(Date.now() / 1000);
  if (!GOOGLE_ISSUERS.includes(payload.iss)) throw new Error("Emisor no confiable");
  if (typeof payload.exp !== "number" || payload.exp < now) throw new Error("Token expirado");
  if (payload.aud !== googleClientId) throw new Error("Audiencia inválida");
  if (!payload.email) throw new Error("Token sin correo");

  return { email: String(payload.email).toLowerCase(), email_verified: payload.email_verified, name: payload.name };
}
