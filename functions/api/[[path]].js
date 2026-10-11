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
import { requireAdmin, requirePanelAdmin } from '../_auth.js';

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
    `SELECT m.id, m.nombre, m.email, m.estado, m.fecha_inicio, m.fecha_fin, m.telefono,
            t.nombre AS tenant_nombre, t.logo_url AS tenant_logo, t.whatsapp AS tenant_whatsapp
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
    nombre: row.nombre,
    email: row.email,
    estado: row.estado,
    fecha_inicio: row.fecha_inicio,
    fecha_fin: row.fecha_fin,
    dias_restantes: Math.max(0, daysUntil(row.fecha_fin)),
    tenant: { nombre: row.tenant_nombre, logo_url: row.tenant_logo, whatsapp: row.tenant_whatsapp },
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

route('GET', 'admin/miembros', async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const url = new URL(request.url);
  const term = str(url.searchParams.get('q') || '', 80);
  const estado = slug(url.searchParams.get('estado') || '', 20);
  const estados = ['activo', 'gracia', 'vencido', 'pendiente', 'rechazado'];

  const where = [];
  const args = [];
  if (estado && estados.includes(estado)) {
    where.push('m.estado = ?');
    args.push(estado);
  }
  if (term) {
    where.push('(m.nombre LIKE ? OR m.email LIKE ? OR m.telefono LIKE ?)');
    const like = `%${term.replace(/[%_]/g, '')}%`;
    args.push(like, like, like);
  }

  const miembros = await query(
    env,
    `SELECT m.id, m.nombre, m.email, m.telefono, m.estado, m.fecha_inicio, m.fecha_fin,
            m.created_at,
            t.id AS tenant_id, t.slug AS tenant_slug, t.nombre AS tenant_nombre, t.whatsapp AS tenant_whatsapp
       FROM miembros m
       JOIN tenants t ON t.id = m.tenant_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.updated_at DESC, m.id DESC
      LIMIT 300`,
    args,
  );

  return respond({ ok: true, total: miembros.length, miembros });
});

route('GET', 'admin/metricas', async ({ request, env }) => {
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const counts = await queryOne(
    env,
    `SELECT
        (SELECT COUNT(*) FROM miembros WHERE estado = 'activo') AS miembros_activos,
        (SELECT COUNT(*) FROM miembros) AS miembros_total,
        (SELECT COUNT(*) FROM pagos WHERE estado = 'pendiente') AS pagos_pendientes,
        (SELECT COUNT(*) FROM pagos WHERE estado = 'confirmado'
           AND strftime('%Y-%m', ifnull(revisado_at, created_at)) = strftime('%Y-%m', 'now')) AS pagos_mes`,
  );
  const mrr = await queryOne(
    env,
    `SELECT COALESCE(SUM(t.precio), 0) AS mrr
       FROM miembros m
       JOIN tenants t ON t.id = m.tenant_id
      WHERE m.estado = 'activo'`,
  );

  return respond({
    ok: true,
    metricas: {
      miembros_activos: num(counts && counts.miembros_activos, 0),
      miembros_total: num(counts && counts.miembros_total, 0),
      pagos_pendientes: num(counts && counts.pagos_pendientes, 0),
      pagos_mes: num(counts && counts.pagos_mes, 0),
      mrr: num(mrr && mrr.mrr, 0),
      moneda: DEFAULT_PRICE_CURRENCY,
    },
  });
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

/* ========================================================================== */
/*  CRM del panel Vendo — /api/admin/crm/*                                     */
/*  Tablas: clients, client_services, memberships, movements, settings,        */
/*          audit_log. Dinero siempre en centavos (INTEGER).                    */
/* ========================================================================== */

const CRM_SERVICE_TO_CATEGORY = {
  web_dev: 'web_sale',
  hosting: 'hosting_monthly',
  vendo_conecta: 'vendo_conecta_monthly',
  nfc_cards: 'web_sale',
  feature_implementation: 'feature_implementation',
  photography: 'photography',
  branding: 'branding',
};
const CRM_SHARED_CATEGORIES = ['photography', 'branding'];
const CRM_INCOME_CATEGORIES = [
  'web_sale',
  'hosting_monthly',
  'vendo_conecta_monthly',
  'feature_implementation',
  'photography',
  'branding',
  'subscription',
];
const CRM_EXPENSE_CATEGORIES = ['nfc_reinvestment', 'unexpected', 'savings', 'partner_payout'];
const CRM_MEMBERSHIP_RANK = { al_dia: 1, proximo_a_vencer: 2, vencido: 3, suspendido: 4 };

function crmId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 21);
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 21);
}
function crmToday() {
  return new Date().toISOString().slice(0, 10);
}
function crmIsoDate(d) {
  return d.toISOString().slice(0, 10);
}
function crmAddMonths(iso, months) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return crmIsoDate(d);
}
function crmNextDue(billingDay, from = new Date()) {
  const day = Math.min(Math.max(Number(billingDay) || 1, 1), 28);
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  if (from.getUTCDate() > day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return crmIsoDate(new Date(Date.UTC(year, month, day)));
}
function crmDaysOverdue(nextDue) {
  if (!nextDue) return 0;
  const a = Date.parse(`${String(nextDue).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${crmToday()}T00:00:00Z`);
  const diff = Math.round((b - a) / 86_400_000);
  return diff > 0 ? diff : 0;
}
function crmDaysUntil(nextDue) {
  if (!nextDue) return 0;
  const a = Date.parse(`${crmToday()}T00:00:00Z`);
  const b = Date.parse(`${String(nextDue).slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
function crmUsdToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function crmPartnerCents(totalCents, pct) {
  return Math.round((totalCents * (100 - pct)) / 100);
}
function crmRoundPct(value) {
  return Math.round(Number(value) * 100) / 100;
}
function crmFormatUsd(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}
function crmFill(template, vars) {
  return String(template || '')
    .replaceAll('{nombre}', vars.nombre || '')
    .replaceAll('{monto}', vars.monto || '')
    .replaceAll('{servicio}', vars.servicio || '')
    .replaceAll('{fecha}', vars.fecha || '')
    .replaceAll('{dias_mora}', String(vars.dias_mora ?? 0));
}
function crmWaUrl(number, text) {
  const digitsOnly = String(number || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(text)}`;
}
function crmAuditStmt(userId, table, recordId, action, oldValues, newValues) {
  return {
    sql: 'INSERT INTO audit_log (id, user_id, table_name, record_id, action, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [
      crmId(),
      userId,
      table,
      recordId,
      action,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
    ],
  };
}
function crmMonthKeys(from, to) {
  const keys = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}
function crmMonthStart(offsetMonths = 0) {
  const now = new Date();
  return crmIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths, 1)));
}
function crmMonthEnd(offsetMonths = 0) {
  const now = new Date();
  return crmIsoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetMonths + 1, 0)));
}
function crmResolveRange(url) {
  const range = url.searchParams.get('range') || 'this_month';
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  if (range === 'custom' && fromParam && toParam) return { from: fromParam, to: toParam };
  if (range === 'last_6') return { from: crmMonthStart(-5), to: crmMonthEnd(0) };
  if (range === 'last_12') return { from: crmMonthStart(-11), to: crmMonthEnd(0) };
  return { from: crmMonthStart(0), to: crmMonthEnd(0) };
}

async function crmAuth(request, env) {
  return requirePanelAdmin(request, env);
}

route('GET', 'admin/crm/summary', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const { from, to } = crmResolveRange(new URL(request.url));

  const totals = await query(
    env,
    'SELECT kind, COALESCE(SUM(amount_cents), 0) AS total FROM movements WHERE movement_date >= ? AND movement_date <= ? GROUP BY kind',
    [from, to],
  );
  let incomeCents = 0;
  let expenseCents = 0;
  for (const row of totals) {
    const total = num(row.total, 0);
    if (row.kind === 'income') incomeCents += total;
    else expenseCents += total;
  }

  const seriesRows = await query(
    env,
    'SELECT substr(movement_date, 1, 7) AS month, kind, COALESCE(SUM(amount_cents), 0) AS total FROM movements WHERE movement_date >= ? AND movement_date <= ? GROUP BY substr(movement_date, 1, 7), kind',
    [from, to],
  );
  const seriesMap = new Map();
  for (const key of crmMonthKeys(from, to)) {
    seriesMap.set(key, { month: key, income_cents: 0, expense_cents: 0, net_cents: 0 });
  }
  for (const row of seriesRows) {
    const point = seriesMap.get(row.month);
    if (!point) continue;
    const total = num(row.total, 0);
    if (row.kind === 'income') point.income_cents += total;
    else point.expense_cents += total;
    point.net_cents = point.income_cents - point.expense_cents;
  }

  const incomeByCategory = await query(
    env,
    'SELECT category, COALESCE(SUM(amount_cents), 0) AS total FROM movements WHERE kind = ? AND movement_date >= ? AND movement_date <= ? GROUP BY category ORDER BY total DESC',
    ['income', from, to],
  );
  const expenseByCategory = await query(
    env,
    'SELECT category, COALESCE(SUM(amount_cents), 0) AS total FROM movements WHERE kind = ? AND movement_date >= ? AND movement_date <= ? GROUP BY category ORDER BY total DESC',
    ['expense', from, to],
  );

  return respond({
    ok: true,
    range: { from, to },
    summary: {
      income_cents: incomeCents,
      expense_cents: expenseCents,
      net_cents: incomeCents - expenseCents,
    },
    series: Array.from(seriesMap.values()),
    income_by_category: incomeByCategory.map((r) => ({ category: r.category, total_cents: num(r.total, 0) })),
    expense_by_category: expenseByCategory.map((r) => ({ category: r.category, total_cents: num(r.total, 0) })),
  });
});

route('GET', 'admin/crm/movements', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const url = new URL(request.url);
  const conditions = [];
  const args = [];
  const kind = url.searchParams.get('kind');
  const category = url.searchParams.get('category');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const clientId = url.searchParams.get('client_id');
  const q = url.searchParams.get('q');

  if (kind === 'income' || kind === 'expense') {
    conditions.push('m.kind = ?');
    args.push(kind);
  }
  if (category) {
    conditions.push('m.category = ?');
    args.push(category);
  }
  if (from) {
    conditions.push('m.movement_date >= ?');
    args.push(from);
  }
  if (to) {
    conditions.push('m.movement_date <= ?');
    args.push(to);
  }
  if (clientId) {
    conditions.push('m.client_id = ?');
    args.push(clientId);
  }
  if (q) {
    conditions.push('m.description LIKE ?');
    args.push(`%${str(q, 80).replace(/[%_]/g, '')}%`);
  }

  const rows = await query(
    env,
    `SELECT m.id, m.kind, m.category, m.amount_cents, m.description, m.movement_date,
            m.client_id, m.is_shared_profit, m.vendo_share_pct, m.linked_movement_id,
            m.created_at, c.full_name AS client_name
       FROM movements m
       LEFT JOIN clients c ON c.id = m.client_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY m.movement_date DESC, m.created_at DESC
      LIMIT 500`,
    args,
  );

  return respond({ ok: true, movements: rows });
});

route('POST', 'admin/crm/movements', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const body = await readJson(request);
  const kind = str(body.kind, 10) === 'expense' ? 'expense' : 'income';
  const category = str(body.category, 40);
  const amountCents = crmUsdToCents(body.amount_usd);
  const movementDate = str(body.date, 10) || crmToday();
  const description = str(body.description, 300) || null;
  const clientId = str(body.client_id, 40) || null;

  const allowed = kind === 'income' ? CRM_INCOME_CATEGORIES : CRM_EXPENSE_CATEGORIES;
  if (!allowed.includes(category)) return fail(400, 'Categoría inválida para el tipo de movimiento');
  if (!amountCents || amountCents <= 0) return fail(400, 'El monto debe ser mayor a cero');

  const shared = kind === 'income' && CRM_SHARED_CATEGORIES.includes(category);
  const vendoPct = shared ? crmRoundPct(num(body.vendo_share_pct, 50)) : null;
  if (shared && (vendoPct < 0 || vendoPct > 100)) return fail(400, 'Porcentaje inválido');

  const movementId = crmId();
  const statements = [
    {
      sql: `INSERT INTO movements (id, kind, category, amount_cents, description, movement_date, client_id, is_shared_profit, vendo_share_pct, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [movementId, kind, category, amountCents, description, movementDate, clientId, shared ? 1 : 0, vendoPct, auth.admin.id],
    },
    crmAuditStmt(auth.admin.id, 'movements', movementId, 'create', null, {
      kind,
      category,
      amount_cents: amountCents,
      movement_date: movementDate,
    }),
  ];

  if (shared) {
    const partnerId = crmId();
    const partnerCents = crmPartnerCents(amountCents, vendoPct);
    statements.push({
      sql: `INSERT INTO movements (id, kind, category, amount_cents, description, movement_date, client_id, is_shared_profit, linked_movement_id, created_by, updated_at)
            VALUES (?, 'expense', 'partner_payout', ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      args: [partnerId, partnerCents, `Pago a socio — ${category}`, movementDate, clientId, movementId, auth.admin.id],
    });
    statements.push(
      crmAuditStmt(auth.admin.id, 'movements', partnerId, 'create', null, {
        kind: 'expense',
        category: 'partner_payout',
        amount_cents: partnerCents,
        linked_movement_id: movementId,
      }),
    );
  }

  await transaction(env, statements);
  return respond({ ok: true, movement_id: movementId });
});

route('DELETE', 'admin/crm/movements/:id', async ({ request, env, params }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const id = str(params.id, 40);
  const existing = await queryOne(env, 'SELECT * FROM movements WHERE id = ? LIMIT 1', [id]);
  if (!existing) return fail(404, 'Movimiento no encontrado');

  await transaction(env, [
    { sql: 'DELETE FROM movements WHERE linked_movement_id = ?', args: [id] },
    { sql: 'DELETE FROM movements WHERE id = ?', args: [id] },
    crmAuditStmt(auth.admin.id, 'movements', id, 'delete', existing, null),
  ]);
  return respond({ ok: true });
});

route('GET', 'admin/crm/clients', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const url = new URL(request.url);
  const q = str(url.searchParams.get('q') || '', 80);
  const args = [];
  let where = '';
  if (q) {
    where = 'WHERE c.full_name LIKE ? OR c.email LIKE ? OR c.whatsapp_number LIKE ?';
    const like = `%${q.replace(/[%_]/g, '')}%`;
    args.push(like, like, like);
  }

  const clients = await query(
    env,
    `SELECT c.id, c.full_name, c.email, c.whatsapp_number, c.notes, c.is_active, c.created_at
       FROM clients c ${where} ORDER BY c.created_at DESC LIMIT 300`,
    args,
  );
  const services = await query(
    env,
    `SELECT cs.id, cs.client_id, cs.service_type, cs.payment_kind, cs.amount_cents, cs.status, cs.start_date,
            m.id AS membership_id, m.next_due_date, m.billing_day, m.last_payment_date, m.status AS membership_status
       FROM client_services cs
       LEFT JOIN memberships m ON m.client_service_id = cs.id
      ORDER BY cs.start_date`,
  );

  const byClient = new Map();
  for (const svc of services) {
    const list = byClient.get(svc.client_id) || [];
    list.push(svc);
    byClient.set(svc.client_id, list);
  }

  const result = clients.map((client) => {
    const list = byClient.get(client.id) || [];
    const recurringActive = list.filter((s) => s.payment_kind === 'recurring' && s.status === 'active');
    const statuses = recurringActive.map((s) => s.membership_status).filter(Boolean);
    const worst = statuses.length
      ? statuses.reduce((a, b) => (CRM_MEMBERSHIP_RANK[b] > CRM_MEMBERSHIP_RANK[a] ? b : a))
      : null;
    return {
      ...client,
      services: list,
      is_entrepreneur: recurringActive.length > 0,
      worst_status: worst,
    };
  });

  return respond({ ok: true, clients: result });
});

route('POST', 'admin/crm/clients', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const body = await readJson(request);
  const fullName = str(body.full_name, 120);
  if (!fullName) return fail(400, 'El nombre es obligatorio');
  const emailValue = str(body.email, 160) || null;
  const whatsapp = digits(body.whatsapp_number, 20) || null;
  const notes = str(body.notes, 500) || null;
  if (whatsapp && !/^[0-9]{8,15}$/.test(whatsapp)) {
    return fail(400, 'El WhatsApp debe tener solo dígitos con código de país');
  }

  const id = crmId();
  await transaction(env, [
    {
      sql: 'INSERT INTO clients (id, full_name, email, whatsapp_number, notes, is_active, updated_at) VALUES (?, ?, ?, ?, ?, 1, datetime(\'now\'))',
      args: [id, fullName, emailValue, whatsapp, notes],
    },
    crmAuditStmt(auth.admin.id, 'clients', id, 'create', null, { full_name: fullName, email: emailValue, whatsapp_number: whatsapp }),
  ]);
  return respond({ ok: true, client_id: id });
});

route('POST', 'admin/crm/clients/:id/services', async ({ request, env, params }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const clientId = str(params.id, 40);
  const client = await queryOne(env, 'SELECT id FROM clients WHERE id = ? LIMIT 1', [clientId]);
  if (!client) return fail(404, 'Cliente no encontrado');

  const body = await readJson(request);
  const serviceType = str(body.service_type, 40);
  const paymentKind = str(body.payment_kind, 20) === 'recurring' ? 'recurring' : 'one_time';
  const amountCents = crmUsdToCents(body.amount_usd);
  const status = str(body.status, 20) || 'active';
  const startDate = str(body.start_date, 10) || crmToday();
  const billingDay = Math.min(Math.max(num(body.billing_day, 1), 1), 28);

  if (!CRM_SERVICE_TO_CATEGORY[serviceType]) return fail(400, 'Tipo de servicio inválido');
  if (!amountCents || amountCents <= 0) return fail(400, 'El precio debe ser mayor a cero');

  const serviceId = crmId();
  const statements = [
    {
      sql: 'INSERT INTO client_services (id, client_id, service_type, payment_kind, amount_cents, status, start_date, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
      args: [serviceId, clientId, serviceType, paymentKind, amountCents, status, startDate],
    },
    crmAuditStmt(auth.admin.id, 'client_services', serviceId, 'create', null, {
      client_id: clientId,
      service_type: serviceType,
      payment_kind: paymentKind,
      amount_cents: amountCents,
    }),
  ];

  if (paymentKind === 'recurring') {
    const membershipId = crmId();
    const nextDue = crmNextDue(billingDay, new Date(`${startDate}T00:00:00Z`));
    statements.push({
      sql: 'INSERT INTO memberships (id, client_service_id, billing_day, next_due_date, status, updated_at) VALUES (?, ?, ?, ?, \'al_dia\', datetime(\'now\'))',
      args: [membershipId, serviceId, billingDay, nextDue],
    });
    statements.push(
      crmAuditStmt(auth.admin.id, 'memberships', membershipId, 'create', null, {
        client_service_id: serviceId,
        billing_day: billingDay,
        next_due_date: nextDue,
      }),
    );
  }

  await transaction(env, statements);
  return respond({ ok: true, service_id: serviceId });
});

route('POST', 'admin/crm/payments', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const body = await readJson(request);
  const clientServiceId = str(body.client_service_id, 40);
  const service = await queryOne(env, 'SELECT * FROM client_services WHERE id = ? LIMIT 1', [clientServiceId]);
  if (!service) return fail(404, 'Servicio no encontrado');

  const amountCents = crmUsdToCents(body.amount_usd) ?? num(service.amount_cents, 0);
  if (!amountCents || amountCents <= 0) return fail(400, 'El monto debe ser mayor a cero');
  const movementDate = str(body.date, 10) || crmToday();
  const category = str(body.category, 40) || CRM_SERVICE_TO_CATEGORY[service.service_type] || 'web_sale';
  if (!CRM_INCOME_CATEGORIES.includes(category)) return fail(400, 'Categoría inválida');

  const shared = CRM_SHARED_CATEGORIES.includes(category);
  const vendoPct = shared ? crmRoundPct(num(body.vendo_share_pct, 50)) : null;

  const membership = await queryOne(env, 'SELECT * FROM memberships WHERE client_service_id = ? LIMIT 1', [clientServiceId]);
  const movementId = crmId();
  const statements = [
    {
      sql: `INSERT INTO movements (id, kind, category, amount_cents, description, movement_date, client_id, client_service_id, is_shared_profit, vendo_share_pct, created_by, updated_at)
            VALUES (?, 'income', ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [movementId, category, amountCents, `Pago — ${service.service_type}`, movementDate, service.client_id, clientServiceId, shared ? 1 : 0, vendoPct, auth.admin.id],
    },
    crmAuditStmt(auth.admin.id, 'movements', movementId, 'create', null, {
      kind: 'income',
      category,
      amount_cents: amountCents,
      client_service_id: clientServiceId,
    }),
  ];

  if (shared) {
    const partnerId = crmId();
    const partnerCents = crmPartnerCents(amountCents, vendoPct);
    statements.push({
      sql: `INSERT INTO movements (id, kind, category, amount_cents, description, movement_date, client_id, client_service_id, is_shared_profit, linked_movement_id, created_by, updated_at)
            VALUES (?, 'expense', 'partner_payout', ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      args: [partnerId, partnerCents, `Pago a socio — ${category}`, movementDate, service.client_id, clientServiceId, movementId, auth.admin.id],
    });
    statements.push(
      crmAuditStmt(auth.admin.id, 'movements', partnerId, 'create', null, {
        kind: 'expense',
        category: 'partner_payout',
        amount_cents: partnerCents,
        linked_movement_id: movementId,
      }),
    );
  }

  if (membership) {
    const nextDue = crmNextDue(membership.billing_day);
    statements.push({
      sql: "UPDATE memberships SET last_payment_date = ?, next_due_date = ?, status = 'al_dia', suspension_date = NULL, updated_at = datetime('now') WHERE id = ?",
      args: [movementDate, nextDue, membership.id],
    });
    statements.push(
      crmAuditStmt(auth.admin.id, 'memberships', membership.id, 'update', { status: membership.status, next_due_date: membership.next_due_date }, { status: 'al_dia', next_due_date: nextDue, last_payment_date: movementDate }),
    );
  }

  await transaction(env, statements);
  return respond({ ok: true, movement_id: movementId });
});

route('GET', 'admin/crm/cobros', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const settings = await queryOne(env, "SELECT * FROM settings WHERE id = 'global' LIMIT 1");
  const warningDays = num(settings && settings.days_before_due_warning, 5);

  const rows = await query(
    env,
    `SELECT m.id AS membership_id, cs.id AS client_service_id, c.id AS client_id, c.full_name AS client_name,
            c.whatsapp_number, c.email, cs.service_type, cs.amount_cents, m.billing_day, cs.start_date,
            m.next_due_date, m.last_payment_date, m.status, m.suspension_date
       FROM memberships m
       JOIN client_services cs ON cs.id = m.client_service_id
       JOIN clients c ON c.id = cs.client_id
      ORDER BY m.next_due_date ASC`,
  );

  const cobros = rows.map((row) => {
    const overdue = crmDaysOverdue(row.next_due_date);
    const until = crmDaysUntil(row.next_due_date);
    let status = row.status;
    if (status !== 'suspendido') {
      if (overdue > 0) status = 'vencido';
      else if (until <= warningDays) status = 'proximo_a_vencer';
      else status = 'al_dia';
    }
    const template = (settings && settings.whatsapp_reminder_template) || 'Hola {nombre}, tu pago de {monto} por {servicio} vence el {fecha}.';
    const message = crmFill(template, {
      nombre: row.client_name,
      monto: crmFormatUsd(row.amount_cents),
      servicio: row.service_type,
      fecha: row.next_due_date,
      dias_mora: overdue,
    });
    return {
      ...row,
      status,
      days_overdue: overdue,
      days_until: until,
      whatsapp_url: crmWaUrl(row.whatsapp_number, message),
    };
  });

  return respond({ ok: true, cobros, warning_days: warningDays });
});

route('GET', 'admin/crm/settings', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const settings = await queryOne(env, "SELECT * FROM settings WHERE id = 'global' LIMIT 1");
  if (!settings) return fail(404, 'No existe la configuración global');
  return respond({ ok: true, settings });
});

route('PUT', 'admin/crm/settings', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const existing = await queryOne(env, "SELECT * FROM settings WHERE id = 'global' LIMIT 1");
  if (!existing) return fail(404, 'No existe la configuración global');

  const body = await readJson(request);
  const payload = {
    photography_vendo_pct: crmRoundPct(num(body.photography_vendo_pct, existing.photography_vendo_pct)),
    branding_vendo_pct: crmRoundPct(num(body.branding_vendo_pct, existing.branding_vendo_pct)),
    days_before_due_warning: Math.min(Math.max(num(body.days_before_due_warning, existing.days_before_due_warning), 0), 60),
    days_overdue_to_suspend: Math.min(Math.max(num(body.days_overdue_to_suspend, existing.days_overdue_to_suspend), 0), 120),
    whatsapp_reminder_template: str(body.whatsapp_reminder_template, 1000) || existing.whatsapp_reminder_template,
    email_reminder_subject: str(body.email_reminder_subject, 200) || existing.email_reminder_subject,
    email_reminder_template: str(body.email_reminder_template, 2000) || existing.email_reminder_template,
  };

  await transaction(env, [
    {
      sql: `UPDATE settings SET photography_vendo_pct = ?, branding_vendo_pct = ?, days_before_due_warning = ?, days_overdue_to_suspend = ?, whatsapp_reminder_template = ?, email_reminder_subject = ?, email_reminder_template = ?, updated_at = datetime('now') WHERE id = 'global'`,
      args: [
        payload.photography_vendo_pct,
        payload.branding_vendo_pct,
        payload.days_before_due_warning,
        payload.days_overdue_to_suspend,
        payload.whatsapp_reminder_template,
        payload.email_reminder_subject,
        payload.email_reminder_template,
      ],
    },
    crmAuditStmt(auth.admin.id, 'settings', 'global', 'update', existing, payload),
  ]);

  return respond({ ok: true });
});

route('GET', 'admin/crm/audit', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const url = new URL(request.url);
  const tableName = str(url.searchParams.get('table') || '', 40);
  const args = [];
  let where = '';
  if (tableName) {
    where = 'WHERE a.table_name = ?';
    args.push(tableName);
  }

  const rows = await query(
    env,
    `SELECT a.id, a.table_name, a.record_id, a.action, a.created_at, a.old_values, a.new_values,
            u.display_name AS user_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
      ORDER BY a.created_at DESC
      LIMIT 200`,
    args,
  );
  return respond({ ok: true, audit: rows });
});

route('GET', 'admin/crm/notifications', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const settings = await queryOne(env, "SELECT * FROM settings WHERE id = 'global' LIMIT 1");
  const warningDays = num(settings && settings.days_before_due_warning, 5);
  const suspendDays = num(settings && settings.days_overdue_to_suspend, 7);

  const rows = await query(
    env,
    `SELECT m.id AS membership_id, c.full_name AS client_name, cs.service_type, cs.amount_cents,
            m.next_due_date, m.status
       FROM memberships m
       JOIN client_services cs ON cs.id = m.client_service_id
       JOIN clients c ON c.id = cs.client_id
      WHERE m.status != 'suspendido'`,
  );

  const alerts = [];
  for (const row of rows) {
    const overdue = crmDaysOverdue(row.next_due_date);
    const until = crmDaysUntil(row.next_due_date);
    if (overdue >= suspendDays) {
      alerts.push({ type: 'suspension_suggested', membership_id: row.membership_id, message: `${row.client_name}: ${row.service_type} supera ${suspendDays} días de mora. Sugerimos suspender.` });
    } else if (overdue > 0) {
      alerts.push({ type: 'payment_overdue', membership_id: row.membership_id, message: `${row.client_name}: ${row.service_type} venció el ${row.next_due_date} (${overdue} día(s) de mora).` });
    } else if (until <= warningDays) {
      alerts.push({ type: 'payment_due_soon', membership_id: row.membership_id, message: `${row.client_name}: ${row.service_type} vence el ${row.next_due_date} (${until} día(s)).` });
    }
  }

  return respond({ ok: true, count: alerts.length, alerts });
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
