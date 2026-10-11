const DEFAULT_TIMEOUT_MS = 10_000;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();
let lastSweep = 0;

function connection(env) {
  const raw = String((env && env.TURSO_DATABASE_URL) || '').trim();
  const token = String((env && env.TURSO_AUTH_TOKEN) || '').trim();
  if (!raw || !token) {
    throw new Error('Turso no configurado: faltan TURSO_DATABASE_URL y/o TURSO_AUTH_TOKEN');
  }
  const base = raw.replace(/^libsql:\/\//i, 'https://').replace(/\/+$/, '');
  return { url: `${base}/v2/pipeline`, token };
}

function toBase64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}

function encodeValue(value) {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { type: 'null' };
    return Number.isInteger(value)
      ? { type: 'integer', value: String(value) }
      : { type: 'float', value };
  }
  if (value instanceof Uint8Array) return { type: 'blob', value: toBase64(value) };
  return { type: 'text', value: String(value) };
}

function decodeValue(cell) {
  if (!cell || cell.type === 'null' || cell.value === null || cell.value === undefined) return null;
  if (cell.type === 'integer') {
    const n = Number(cell.value);
    return Number.isSafeInteger(n) ? n : cell.value;
  }
  if (cell.type === 'float') {
    const n = Number(cell.value);
    return Number.isNaN(n) ? null : n;
  }
  return cell.value;
}

function normalize(result) {
  const columns = (result.cols || []).map((c) => c.name);
  const rows = (result.rows || []).map((row) => {
    const record = {};
    row.forEach((cell, i) => {
      record[columns[i]] = decodeValue(cell);
    });
    return record;
  });
  return {
    columns,
    rows,
    rowsAffected: result.affected_row_count ?? 0,
    lastInsertRowid:
      result.last_insert_rowid === null || result.last_insert_rowid === undefined
        ? null
        : Number(result.last_insert_rowid),
  };
}

function pickResult(payload, index) {
  const item = payload && payload.results ? payload.results[index] : null;
  if (!item) throw new Error('Respuesta de Turso vacía o incompleta');
  if (item.type !== 'ok') {
    throw new Error(`Turso: ${JSON.stringify(item.error || item).slice(0, 400)}`);
  }
  return normalize((item.response && item.response.result) || {});
}

async function pipeline(env, requests) {
  const { url, token } = connection(env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(`No se pudo contactar a Turso: ${err && err.message ? err.message : err}`);
  } finally {
    clearTimeout(timer);
  }

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Turso HTTP ${response.status}: ${body.slice(0, 300)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Turso devolvió una respuesta no válida');
  }
}

export async function execute(env, sql, args = []) {
  const payload = await pipeline(env, [
    { type: 'execute', stmt: { sql: String(sql), args: args.map(encodeValue) } },
    { type: 'close' },
  ]);
  return pickResult(payload, 0);
}

export async function query(env, sql, args = []) {
  return (await execute(env, sql, args)).rows;
}

export async function queryOne(env, sql, args = []) {
  return (await execute(env, sql, args)).rows[0] ?? null;
}

export async function run(env, sql, args = []) {
  return execute(env, sql, args);
}

export async function batch(env, statements = []) {
  const requests = statements.map((stmt) => ({
    type: 'execute',
    stmt: { sql: String(stmt.sql), args: (stmt.args || []).map(encodeValue) },
  }));
  requests.push({ type: 'close' });
  const payload = await pipeline(env, requests);
  return statements.map((_, i) => pickResult(payload, i));
}

export async function transaction(env, statements = []) {
  const requests = [{ type: 'execute', stmt: { sql: 'BEGIN', args: [] } }];
  for (const stmt of statements) {
    requests.push({
      type: 'execute',
      stmt: { sql: String(stmt.sql), args: (stmt.args || []).map(encodeValue) },
    });
  }
  requests.push({ type: 'execute', stmt: { sql: 'COMMIT', args: [] } });
  requests.push({ type: 'close' });
  const payload = await pipeline(env, requests);
  return statements.map((_, i) => pickResult(payload, i + 1));
}

export function str(value, max = 255) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\u0000/g, '').trim().slice(0, max);
}

export function num(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function bool(value) {
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  const s = String(value == null ? '' : value).toLowerCase();
  return ['1', 'true', 'si', 'sí', 'yes', 'on'].includes(s) ? 1 : 0;
}

export function email(value, max = 160) {
  const s = str(value, max).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
}

export function slug(value, max = 60) {
  return str(value, max)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function digits(value, max = 20) {
  return str(value, max).replace(/\D/g, '');
}

export function clientIp(request) {
  const header =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Real-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0];
  return str(header, 64) || 'local';
}

function sweep(now) {
  if (now - lastSweep < 30_000) return;
  lastSweep = now;
  for (const [key, bucket] of rateBuckets) {
    if (bucket.reset <= now) rateBuckets.delete(key);
  }
}

export function rateLimit(key, options = {}) {
  const limit = num(options.limit, 30) || 30;
  const windowMs = num(options.windowMs, RATE_WINDOW_MS) || RATE_WINDOW_MS;
  const now = Date.now();
  sweep(now);
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: allowed ? 0 : Math.ceil((bucket.reset - now) / 1000),
  };
}
