import {
  batch,
  clientIp,
  digits,
  email,
  num,
  query,
  queryOne,
  rateLimit,
  run,
  slug,
  str,
  transaction,
} from '../_db.js';
import { requireAdmin } from '../_auth.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const DEFAULT_PRICE_CURRENCY = 'USD';
const GRACE_DAYS = 3;

export function respond(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function ok(data = null, status = 200) {
  return respond({ ok: true, data }, status);
}

export function fail(status, error, extra = {}) {
  return respond({ ok: false, error, ...extra }, status);
}

export function clientKey(request, scope = '') {
  return `${scope}:${clientIp(request)}`;
}

export function guard(request, scope, options = {}) {
  return rateLimit(clientKey(request, scope), options);
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function readJson(request, maxBytes = 16_384) {
  const type = request.headers.get('content-type') || '';
  if (type && !type.includes('application/json')) {
    throw new ApiError(415, 'Se esperaba application/json');
  }
  const text = await request.text();
  if (!text) return {};
  if (text.length > maxBytes) throw new ApiError(413, 'Cuerpo de la solicitud demasiado grande');
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new ApiError(400, 'JSON inválido');
  }
}

function parseJsonField(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const target = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return 0;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target.getTime() - today) / 86_400_000);
}

async function tenantBySlug(env, value) {
  const clean = slug(value, 60);
  if (!clean) return null;
  return queryOne(env, 'SELECT * FROM tenants WHERE slug = ? AND activo = 1 LIMIT 1', [clean]);
}

function publicTenant(tenant) {
  return {
    slug: tenant.slug,
    nombre: tenant.nombre,
    descripcion: tenant.descripcion,
    logo_url: tenant.logo_url,
    precio: num(tenant.precio, 0),
    moneda: tenant.moneda || DEFAULT_PRICE_CURRENCY,
    beneficios: parseJsonField(tenant.beneficios, []),
    metodos_pago: parseJsonField(tenant.metodos_pago, {}),
    whatsapp: tenant.whatsapp,
    instrucciones_pago: tenant.instrucciones_pago,
    colores: {
      primario: tenant.color_primario,
      secundario: tenant.color_secundario,
      fondo: tenant.color_fondo,
    },
  };
}

function tooMany(result) {
  return fail(429, 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.', {
    retry_after: result.retryAfter,
  });
}

const routes = [];

function route(method, pattern, handler) {
  routes.push({
    method,
    parts: pattern.replace(/^\//, '').split('/').filter(Boolean),
    handler,
  });
}

function matchPattern(parts, segments) {
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(segments[i]);
    } else if (part !== segments[i]) {
      return null;
    }
  }
  return params;
}

function findRoute(method, segments) {
  let pathMatched = false;
  for (const candidate of routes) {
    if (candidate.parts.length !== segments.length) continue;
    const params = matchPattern(candidate.parts, segments);
    if (!params) continue;
    pathMatched = true;
    if (candidate.method === method) return { handler: candidate.handler, params, pathMatched };
  }
  return { handler: null, params: null, pathMatched };
}

route('GET', 'health', async () => respond({ status: 'ok', timestamp: new Date().toISOString() }));

route('GET', 'club/:slug', async ({ env, params }) => {
  const tenant = await tenantBySlug(env, params.slug);
  if (!tenant) return fail(404, 'Club no encontrado');
  return respond({ ok: true, club: publicTenant(tenant) });
});

route('POST', 'checkout/iniciar', async ({ request, env }) => {
  const limited = guard(request, 'checkout', { limit: 12, windowMs: 60_000 });
  if (!limited.allowed) return tooMany(limited);

  const body = await readJson(request);
  const tenantSlug = slug(body.tenant_slug, 60);
  const nombre = str(body.nombre, 120);
  const correo = email(body.email, 160);
  const telefono = str(body.telefono, 30);

  if (!tenantSlug || !nombre || !correo || !telefono) {
    return fail(400, 'Faltan datos requeridos (tenant_slug, nombre, email, telefono).');
  }
  if (digits(telefono).length < 7) return fail(400, 'Teléfono inválido.');

  const tenant = await tenantBySlug(env, tenantSlug);
  if (!tenant) return fail(404, 'Club no encontrado');

  let miembro = await queryOne(
    env,
    'SELECT id, estado FROM miembros WHERE tenant_id = ? AND email = ? LIMIT 1',
    [tenant.id, correo],
  );

  if (miembro) {
    await run(
      env,
      "UPDATE miembros SET nombre = ?, telefono = ?, updated_at = datetime('now') WHERE id = ?",
      [nombre, telefono, miembro.id],
    );
  } else {
    try {
      const inserted = await run(
        env,
        "INSERT INTO miembros (tenant_id, nombre, email, telefono, estado) VALUES (?, ?, ?, ?, 'pendiente')",
        [tenant.id, nombre, correo, telefono],
      );
      miembro = { id: inserted.lastInsertRowid, estado: 'pendiente' };
    } catch (err) {
      if (!String((err && err.message) || err).includes('UNIQUE')) throw err;
      miembro = await queryOne(
        env,
        'SELECT id, estado FROM miembros WHERE tenant_id = ? AND email = ? LIMIT 1',
        [tenant.id, correo],
      );
      await run(
        env,
        "UPDATE miembros SET nombre = ?, telefono = ?, updated_at = datetime('now') WHERE id = ?",
        [nombre, telefono, miembro.id],
      );
    }
  }

  return respond({
    ok: true,
    miembro_id: miembro.id,
    estado: miembro.estado,
    instrucciones_pago: tenant.instrucciones_pago,
    metodos_pago: parseJsonField(tenant.metodos_pago, {}),
    monto: num(tenant.precio, 0),
    moneda: tenant.moneda || DEFAULT_PRICE_CURRENCY,
  });
});

route('POST', 'pagos/reportar', async ({ request, env }) => {
  const limited = guard(request, 'pagos-reportar', { limit: 12, windowMs: 60_000 });
  if (!limited.allowed) return tooMany(limited);

  const body = await readJson(request);
  const tenantSlug = slug(body.tenant_slug, 60);
  const miembroId = Math.trunc(num(body.miembro_id, 0));
  const referencia = str(body.referencia, 80);
  const metodo = str(body.metodo, 30);

  if (!tenantSlug || miembroId <= 0 || !referencia || !metodo) {
    return fail(400, 'Faltan datos requeridos (tenant_slug, miembro_id, referencia, metodo).');
  }

  const tenant = await tenantBySlug(env, tenantSlug);
  if (!tenant) return fail(404, 'Club no encontrado');

  const miembro = await queryOne(
    env,
    'SELECT id FROM miembros WHERE id = ? AND tenant_id = ? LIMIT 1',
    [miembroId, tenant.id],
  );
  if (!miembro) return fail(404, 'Miembro no encontrado para este club');

  const duplicado = await queryOne(
    env,
    'SELECT id FROM pagos WHERE tenant_id = ? AND referencia = ? LIMIT 1',
    [tenant.id, referencia],
  );
  if (duplicado) return fail(409, 'Esta referencia ya fue reportada');

  const monto = body.monto === undefined || body.monto === null ? num(tenant.precio, 0) : num(body.monto, 0);

  let pago;
  try {
    pago = await run(
      env,
      "INSERT INTO pagos (tenant_id, miembro_id, referencia, metodo, monto, moneda, estado) VALUES (?, ?, ?, ?, ?, ?, 'pendiente')",
      [tenant.id, miembroId, referencia, metodo, monto, tenant.moneda || DEFAULT_PRICE_CURRENCY],
    );
  } catch (err) {
    if (String((err && err.message) || err).includes('UNIQUE')) {
      return fail(409, 'Esta referencia ya fue reportada');
    }
    throw err;
  }

  return respond({
    ok: true,
    pago_id: pago.lastInsertRowid,
    mensaje: 'Pago reportado con éxito, en espera de confirmación',
  });
});

route('POST', 'membresia/estado', async ({ request, env }) => {
  const limited = guard(request, 'membresia-estado', { limit: 30, windowMs: 60_000 });
  if (!limited.allowed) return tooMany(limited);

  const body = await readJson(request);
  const tenantSlug = slug(body.tenant_slug, 60);
  const correo = email(body.email, 160);
  const last4 = digits(body.ultimos4_telefono, 10).slice(-4);

  if (!tenantSlug || !correo || last4.length !== 4) {
    return fail(400, 'Faltan datos requeridos (tenant_slug, email, ultimos4_telefono).');
  }

  const row = await queryOne(
    env,
    `SELECT m.id, m.estado, m.fecha_inicio, m.fecha_fin, m.telefono,
            t.nombre AS tenant_nombre, t.logo_url AS tenant_logo
       FROM miembros m
       JOIN tenants t ON t.id = m.tenant_id
      WHERE t.slug = ? AND t.activo = 1 AND m.email = ?
      LIMIT 1`,
    [tenantSlug, correo],
  );
  if (!row) return fail(404, 'No encontramos una membresía con estos datos');

  if (digits(row.telefono, 30).slice(-4) !== last4) {
    return fail(401, 'Los datos no coinciden');
  }

  return respond({
    ok: true,
    estado: row.estado,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    dias_restantes: Math.max(0, daysUntil(row.fecha_fin)),
    tenant: { nombre: row.tenant_nombre, logo_url: row.tenant_logo },
  });
});

route('GET', 'admin/pagos', async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const url = new URL(request.url);
  const estado = str(url.searchParams.get('estado') || 'pendiente', 20) || 'pendiente';
  const valido = ['pendiente', 'confirmado', 'rechazado', 'todos'].includes(estado);
  const where = valido && estado !== 'todos' ? 'WHERE p.estado = ?' : '';
  const args = where ? [estado] : [];

  const pagos = await query(
    env,
    `SELECT p.id, p.referencia, p.metodo, p.monto, p.moneda, p.captura_url, p.estado,
            p.motivo_rechazo, p.revisado_por, p.revisado_at, p.created_at,
            m.id AS miembro_id, m.nombre AS miembro_nombre, m.email AS miembro_email,
            m.telefono AS miembro_telefono, m.estado AS miembro_estado,
            t.id AS tenant_id, t.slug AS tenant_slug, t.nombre AS tenant_nombre
       FROM pagos p
       JOIN miembros m ON m.id = p.miembro_id
       JOIN tenants t ON t.id = p.tenant_id
       ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 200`,
    args,
  );

  return respond({ ok: true, total: pagos.length, pagos });
});

route('POST', 'admin/pagos/:id/confirmar', async ({ request, env, params }) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const pagoId = Math.trunc(num(params.id, 0));
  if (pagoId <= 0) return fail(400, 'Identificador de pago inválido');

  const pago = await queryOne(
    env,
    `SELECT p.id, p.estado, p.tenant_id, p.miembro_id, p.referencia,
            m.estado AS miembro_estado, m.fecha_fin AS miembro_fecha_fin
       FROM pagos p
       JOIN miembros m ON m.id = p.miembro_id
      WHERE p.id = ?
      LIMIT 1`,
    [pagoId],
  );
  if (!pago) return fail(404, 'Pago no encontrado');
  if (pago.estado === 'confirmado') return fail(409, 'El pago ya fue confirmado');
  if (pago.estado === 'rechazado') return fail(409, 'El pago fue rechazado previamente');

  const vigente =
    pago.miembro_estado === 'activo' &&
    pago.miembro_fecha_fin != null &&
    String(pago.miembro_fecha_fin).slice(0, 10) >= todayUTC();

  const fechaFinExpr = vigente
    ? "date(max(ifnull(fecha_fin, date('now')), date('now')), '+30 days')"
    : "date('now', '+30 days')";

  const payload = JSON.stringify({
    evento: 'membresia.activada',
    pago_id: pagoId,
    miembro_id: pago.miembro_id,
    tenant_id: pago.tenant_id,
    referencia: pago.referencia,
    revisado_por: auth.admin.email,
    fecha: todayUTC(),
  });

  await transaction(env, [
    {
      sql: "UPDATE pagos SET estado = 'confirmado', revisado_por = ?, revisado_at = datetime('now') WHERE id = ?",
      args: [auth.admin.email, pagoId],
    },
    {
      sql: `UPDATE miembros
               SET estado = 'activo',
                   fecha_inicio = ifnull(fecha_inicio, date('now')),
                   fecha_fin = ${fechaFinExpr},
                   updated_at = datetime('now')
             WHERE id = ?`,
      args: [pago.miembro_id],
    },
    {
      sql: "INSERT INTO webhook_eventos (tenant_id, evento, payload) VALUES (?, 'membresia.activada', ?)",
      args: [pago.tenant_id, payload],
    },
  ]);

  const miembro = await queryOne(
    env,
    'SELECT id, estado, fecha_inicio, fecha_fin FROM miembros WHERE id = ? LIMIT 1',
    [pago.miembro_id],
  );

  return respond({
    ok: true,
    miembro_actualizado: {
      id: miembro.id,
      estado: miembro.estado,
      fecha_inicio: miembro.fecha_inicio,
      fecha_fin: miembro.fecha_fin,
    },
  });
});

route('POST', 'admin/pagos/:id/rechazar', async ({ request, env, params }) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const pagoId = Math.trunc(num(params.id, 0));
  if (pagoId <= 0) return fail(400, 'Identificador de pago inválido');

  const body = await readJson(request);
  const motivo = str(body.motivo || body.motivo_rechazo, 300) || 'Sin motivo especificado';

  const pago = await queryOne(env, 'SELECT id, estado FROM pagos WHERE id = ? LIMIT 1', [pagoId]);
  if (!pago) return fail(404, 'Pago no encontrado');
  if (pago.estado !== 'pendiente') return fail(409, 'El pago ya fue revisado');

  await run(
    env,
    "UPDATE pagos SET estado = 'rechazado', motivo_rechazo = ?, revisado_por = ?, revisado_at = datetime('now') WHERE id = ?",
    [motivo, auth.admin.email, pagoId],
  );

  return respond({ ok: true, pago: { id: pagoId, estado: 'rechazado', motivo_rechazo: motivo } });
});

async function cronAuthorized(request, env) {
  const secret = env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get('x-cron-secret') || '';
    const authHeader = request.headers.get('Authorization') || '';
    const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    if (header === secret || bearer === secret) return true;
  }
  const auth = await requireAdmin(request, env);
  return auth.ok;
}

route('POST', 'admin/cron/diario', async ({ request, env }) => {
  if (!(await cronAuthorized(request, env))) return fail(401, 'No autorizado');

  const aGracia = await query(
    env,
    "SELECT id, tenant_id FROM miembros WHERE estado = 'activo' AND fecha_fin IS NOT NULL AND date(fecha_fin) < date('now')",
  );
  if (aGracia.length) {
    await run(
      env,
      "UPDATE miembros SET estado = 'gracia', updated_at = datetime('now') WHERE estado = 'activo' AND fecha_fin IS NOT NULL AND date(fecha_fin) < date('now')",
    );
  }

  const aVencido = await query(
    env,
    `SELECT id, tenant_id FROM miembros
      WHERE estado = 'gracia' AND fecha_fin IS NOT NULL
        AND date(fecha_fin) < date('now', '-${GRACE_DAYS} days')`,
  );
  if (aVencido.length) {
    await run(
      env,
      `UPDATE miembros SET estado = 'vencido', updated_at = datetime('now')
        WHERE estado = 'gracia' AND fecha_fin IS NOT NULL
          AND date(fecha_fin) < date('now', '-${GRACE_DAYS} days')`,
    );
  }

  const eventos = [
    ...aGracia.map((m) => ({
      sql: "INSERT INTO webhook_eventos (tenant_id, evento, payload) VALUES (?, 'membresia.en_gracia', ?)",
      args: [m.tenant_id, JSON.stringify({ miembro_id: m.id, fecha: todayUTC() })],
    })),
    ...aVencido.map((m) => ({
      sql: "INSERT INTO webhook_eventos (tenant_id, evento, payload) VALUES (?, 'membresia.vencida', ?)",
      args: [m.tenant_id, JSON.stringify({ miembro_id: m.id, fecha: todayUTC() })],
    })),
  ];
  if (eventos.length) await batch(env, eventos);

  return respond({
    ok: true,
    procesados: { a_gracia: aGracia.length, a_vencido: aVencido.length },
    eventos_encolados: eventos.length,
  });
});

function pathSegments(context) {
  const { params, request } = context;
  if (Array.isArray(params && params.path)) return params.path.map(String);
  if (typeof (params && params.path) === 'string' && params.path) {
    return params.path.split('/').filter(Boolean);
  }
  const raw = new URL(request.url).pathname.replace(/^\/api\/?/, '');
  return raw.split('/').filter(Boolean).map((part) => str(part, 200));
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method.toUpperCase();
  const segments = pathSegments(context);
  const path = `/${segments.join('/')}`;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { Allow: 'GET, POST, OPTIONS', 'Cache-Control': 'no-store' },
    });
  }

  try {
    const found = findRoute(method, segments);
    if (!found.handler) {
      if (found.pathMatched) return fail(405, 'Método no permitido');
      return fail(404, 'Ruta de API no encontrada', { path });
    }
    return await found.handler({ request, env, params: found.params, context });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.status, err.message);
    return fail(500, 'Error interno del servidor', {
      detail: String((err && err.message) || err).slice(0, 200),
    });
  }
}
