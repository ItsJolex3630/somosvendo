import {
  batch,
  clientIp,
  digits,
  email,
  execute,
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
const FALLBACK_GOOGLE_CLIENT_ID = '39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com';

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

route('GET', 'config', async ({ env }) =>
  respond({ ok: true, google_client_id: (env && env.GOOGLE_CLIENT_ID) || FALLBACK_GOOGLE_CLIENT_ID }),
);



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
  google_maps: 'google_maps',
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
  'google_maps',
  'custom_income',
];
const CRM_EXPENSE_CATEGORIES = [
  'ai_credits',
  'software_sub',
  'advertising',
  'nfc_reinvestment',
  'domains_servers',
  'partner_payout',
  'unexpected',
  'savings',
  'custom_expense',
];
const CRM_CATEGORY_NAMES = {
  web_sale: 'Venta web',
  hosting_monthly: 'Hosting mensual',
  vendo_conecta_monthly: 'Vendo Conecta mensual',
  feature_implementation: 'Implementación',
  photography: 'Sesión fotográfica',
  branding: 'Creación de marca',
  subscription: 'Suscripción',
  google_maps: 'Google Maps',
  custom_income: 'Ingreso personalizado',
  ai_credits: 'Créditos IA / Tokens',
  software_sub: 'Suscripciones Software / IA',
  advertising: 'Publicidad & Ads',
  nfc_reinvestment: 'Compra de Etiquetas / Tarjetas NFC',
  domains_servers: 'Dominios & Servidores',
  partner_payout: 'Pago a socio',
  unexpected: 'Gasto único / Imprevisto',
  savings: 'Ahorro / Reserva',
  custom_expense: 'Gasto personalizado',
};
const CRM_MEMBERSHIP_RANK = { al_dia: 1, proximo_a_vencer: 2, vencido: 3, suspendido: 4 };

function slugifyCategory(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36) || 'custom_item';
}

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
    `SELECT m.id, m.kind, m.category, COALESCE(m.frequency, 'one_time') AS frequency,
            m.amount_cents, m.description, m.movement_date,
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
  const frequency = str(body.frequency, 20) === 'recurring' ? 'recurring' : 'one_time';
  const newCategoryLabel = str(body.new_category_label, 60);
  let category = str(body.category, 40);

  const statements = [];
  if (newCategoryLabel) {
    category = slugifyCategory(newCategoryLabel);
    statements.push({
      sql: `INSERT OR IGNORE INTO custom_categories (id, kind, slug, label, frequency_default, created_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [crmId(), kind, category, newCategoryLabel, frequency],
    });
  }
  if (!category) {
    category = kind === 'expense' ? 'unexpected' : 'custom_income';
  }

  const amountCents = crmUsdToCents(body.amount_usd);
  const movementDate = str(body.date, 10) || crmToday();
  const description = str(body.description, 300) || (CRM_CATEGORY_NAMES[category] || newCategoryLabel || category);
  const clientId = str(body.client_id, 40) || null;

  if (!amountCents || amountCents <= 0) return fail(400, 'El monto debe ser mayor a cero');

  const shared = kind === 'income' && CRM_SHARED_CATEGORIES.includes(category);
  const vendoPct = shared ? crmRoundPct(num(body.vendo_share_pct, 50)) : null;
  if (shared && (vendoPct < 0 || vendoPct > 100)) return fail(400, 'Porcentaje inválido');

  const movementId = crmId();
  statements.push(
    {
      sql: `INSERT INTO movements (id, kind, category, frequency, amount_cents, description, movement_date, client_id, is_shared_profit, vendo_share_pct, created_by, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      args: [movementId, kind, category, frequency, amountCents, description, movementDate, clientId, shared ? 1 : 0, vendoPct, String(auth.admin.id)],
    },
    crmAuditStmt(String(auth.admin.id), 'movements', movementId, 'create', null, {
      kind,
      category,
      frequency,
      amount_cents: amountCents,
      movement_date: movementDate,
    }),
  );

  if (shared) {
    const partnerId = crmId();
    const partnerCents = crmPartnerCents(amountCents, vendoPct);
    statements.push({
      sql: `INSERT INTO movements (id, kind, category, frequency, amount_cents, description, movement_date, client_id, is_shared_profit, linked_movement_id, created_by, updated_at)
            VALUES (?, 'expense', 'partner_payout', 'one_time', ?, ?, ?, ?, 0, ?, ?, datetime('now'))`,
      args: [partnerId, partnerCents, `Pago a socio — ${category}`, movementDate, clientId, movementId, String(auth.admin.id)],
    });
  }

  await transaction(env, statements);
  return respond({ ok: true, movement_id: movementId, category });
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

/* ========================================================================== */
/*  CATEGORÍAS PERSONALIZADAS & AGENTE INTELIGENTE "DO" CONECTADO A TURSO DB  */
/* ========================================================================== */

route('GET', 'admin/crm/categories', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const categories = await query(
    env,
    'SELECT id, kind, slug, label, frequency_default, created_at FROM custom_categories ORDER BY created_at ASC',
  );
  return respond({ ok: true, categories });
});

route('POST', 'admin/crm/categories', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const body = await readJson(request);
  const kind = str(body.kind, 10) === 'income' ? 'income' : 'expense';
  const label = str(body.label, 60);
  if (!label) return fail(400, 'El nombre de la categoría es obligatorio');
  const slug = slugifyCategory(body.slug || label);
  const frequencyDefault = str(body.frequency_default, 20) === 'recurring' ? 'recurring' : 'one_time';
  const id = crmId();
  await execute(
    env,
    `INSERT OR REPLACE INTO custom_categories (id, kind, slug, label, frequency_default, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    [id, kind, slug, label, frequencyDefault],
  );
  return respond({ ok: true, category: { id, kind, slug, label, frequency_default: frequencyDefault } });
});

route('DELETE', 'admin/crm/categories/:id', async ({ request, env, params }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const id = str(params.id, 40);
  await execute(env, 'DELETE FROM custom_categories WHERE id = ? OR slug = ?', [id, id]);
  return respond({ ok: true });
});

route('GET', 'admin/crm/agent/state', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const [messages, memories, categories] = await Promise.all([
    query(env, 'SELECT id, role, content, actions_json, created_at FROM do_chat_messages ORDER BY created_at ASC LIMIT 80'),
    query(env, 'SELECT id, topic, content, created_at FROM do_agent_memory ORDER BY created_at DESC LIMIT 100'),
    query(env, 'SELECT id, kind, slug, label, frequency_default FROM custom_categories ORDER BY created_at ASC'),
  ]);

  return respond({
    ok: true,
    messages: messages.map((m) => ({
      ...m,
      actions: m.actions_json ? JSON.parse(m.actions_json) : [],
    })),
    memories,
    categories,
  });
});

route('POST', 'admin/crm/agent/memory', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const body = await readJson(request);
  const content = str(body.content, 500);
  const topic = str(body.topic, 40) || 'regla_negocio';
  if (!content) return fail(400, 'El contenido es obligatorio');
  const id = crmId();
  await execute(
    env,
    "INSERT INTO do_agent_memory (id, topic, content, created_at) VALUES (?, ?, ?, datetime('now'))",
    [id, topic, content],
  );
  return respond({ ok: true, memory: { id, topic, content } });
});

route('DELETE', 'admin/crm/agent/memory/:id', async ({ request, env, params }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  const id = str(params.id, 40);
  await execute(env, 'DELETE FROM do_agent_memory WHERE id = ?', [id]);
  return respond({ ok: true });
});

route('DELETE', 'admin/crm/agent/history', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);
  await execute(env, 'DELETE FROM do_chat_messages');
  return respond({ ok: true });
});

route('POST', 'admin/crm/agent/chat', async ({ request, env }) => {
  const auth = await crmAuth(request, env);
  if (!auth.ok) return fail(auth.status, auth.error);

  const body = await readJson(request);
  const userMessage = str(body.message, 1500);
  if (!userMessage) return fail(400, 'Escribe un mensaje para Do');

  // 1. Cargar snapshot completo y en tiempo real de Turso DB
  const monthFrom = crmMonthStart(0);
  const monthTo = crmMonthEnd(0);
  const [clients, services, movements, customCats, memories, settings] = await Promise.all([
    query(env, 'SELECT id, full_name, email, whatsapp_number, notes, is_active, created_at FROM clients ORDER BY full_name ASC'),
    query(
      env,
      `SELECT cs.id, cs.client_id, cs.service_type, cs.payment_kind, cs.amount_cents, cs.status, cs.start_date,
              m.id AS membership_id, m.next_due_date, m.billing_day, m.last_payment_date, m.status AS membership_status
         FROM client_services cs
         LEFT JOIN memberships m ON m.client_service_id = cs.id`,
    ),
    query(
      env,
      `SELECT m.id, m.kind, m.category, COALESCE(m.frequency, 'one_time') AS frequency,
              m.amount_cents, m.description, m.movement_date, m.client_id, c.full_name AS client_name
         FROM movements m
         LEFT JOIN clients c ON c.id = m.client_id
        ORDER BY m.movement_date DESC, m.created_at DESC
        LIMIT 300`,
    ),
    query(env, 'SELECT id, kind, slug, label, frequency_default FROM custom_categories'),
    query(env, 'SELECT id, topic, content FROM do_agent_memory ORDER BY created_at DESC LIMIT 50'),
    queryOne(env, "SELECT * FROM settings WHERE id = 'global' LIMIT 1"),
  ]);

  const catLabels = { ...CRM_CATEGORY_NAMES };
  for (const c of customCats) catLabels[c.slug] = c.label;

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const textLower = norm(userMessage);
  const actionsExecuted = [];
  const replyParts = [];

  // Helper para buscar cliente mencionado en el mensaje
  function findMentionedClient(msgNorm) {
    let best = null;
    let bestLen = 0;
    for (const c of clients) {
      const n = norm(c.full_name);
      if (n && msgNorm.includes(n) && n.length > bestLen) {
        best = c;
        bestLen = n.length;
      } else {
        const tokens = n.split(/\s+/).filter((w) => w.length >= 4);
        for (const tk of tokens) {
          if (msgNorm.includes(tk) && tk.length > bestLen) {
            best = c;
            bestLen = tk.length;
          }
        }
      }
    }
    return best;
  }

  // Helper para extraer monto en USD ($10, 10$, 10 usd, 10 dolares, por 10)
  function extractAmountUsd(rawText) {
    const patterns = [
      /\$\s*(\d+(?:[.,]\d{1,2})?)/i,
      /(\d+(?:[.,]\d{1,2})?)\s*\$/i,
      /(\d+(?:[.,]\d{1,2})?)\s*(?:usd|dolares|dolar|dlrs| verdes)/i,
      /(?:de|por|monto|salio|costo|fueron|pago|pague|gaste)\s+\$?\s*(\d+(?:[.,]\d{1,2})?)/i,
    ];
    for (const re of patterns) {
      const m = rawText.match(re);
      if (m && m[1]) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (val > 0 && val < 1000000) return val;
      }
    }
    return null;
  }

  // Helper para inferir categoría de gasto o ingreso
  function inferExpenseCategory(msgNorm) {
    for (const c of customCats.filter((x) => x.kind === 'expense')) {
      if (msgNorm.includes(norm(c.label)) || msgNorm.includes(c.slug)) return c.slug;
    }
    if (/(credito|token|recarga)/.test(msgNorm)) return 'ai_credits';
    if (/(suscripcion|mensualidad|plan|software|herramienta|canva|notion|figma)/.test(msgNorm)) return 'software_sub';
    if (/(ia|ai|kimi|claude|openai|gpt|cursor|gemini|api)/.test(msgNorm)) return 'ai_credits';
    if (/(publicidad|ads|anuncio|meta|instagram|facebook|tiktok|campana|marketing)/.test(msgNorm)) return 'advertising';
    if (/(nfc|tarjeta|etiqueta|carnet|chip|plastico)/.test(msgNorm)) return 'nfc_reinvestment';
    if (/(dominio|hosting|servidor|cloudflare|namecheap|godaddy|dns)/.test(msgNorm)) return 'domains_servers';
    if (/(socio|ali gomez|comision|fotografo)/.test(msgNorm)) return 'partner_payout';
    if (/(ahorro|reserva|fondo)/.test(msgNorm)) return 'savings';
    return 'unexpected';
  }

  function inferIncomeCategory(msgNorm) {
    for (const c of customCats.filter((x) => x.kind === 'income')) {
      if (msgNorm.includes(norm(c.label)) || msgNorm.includes(c.slug)) return c.slug;
    }
    if (/(mapa|maps|google|ficha|ubicacion)/.test(msgNorm)) return 'google_maps';
    if (/(conecta|fidelizacion|club|vip|membresia)/.test(msgNorm)) return 'vendo_conecta_monthly';
    if (/(hosting|mantenimiento|renovacion|dominio)/.test(msgNorm)) return 'hosting_monthly';
    if (/(foto|fotografia|sesion|ali gomez)/.test(msgNorm)) return 'photography';
    if (/(branding|marca|logo|diseno)/.test(msgNorm)) return 'branding';
    if (/(implementacion|mejora|funcion|extra)/.test(msgNorm)) return 'feature_implementation';
    if (/(suscripcion|retainer|mensual)/.test(msgNorm)) return 'subscription';
    return 'web_sale';
  }

  // =========================================================================
  // INTENCIÓN 1: AUTO-ENTRENAMIENTO / MEMORIA ("recuerda que...", "aprende que...")
  // =========================================================================
  const memoryMatch = userMessage.match(/(?:recuerda que|aprende que|guarda en tu memoria que|ten en cuenta que|nota mental:?|entrenate:?)\s+(.+)/i);
  if (memoryMatch && memoryMatch[1]) {
    const fact = memoryMatch[1].trim();
    const memId = crmId();
    await execute(
      env,
      "INSERT INTO do_agent_memory (id, topic, content, created_at) VALUES (?, 'regla_negocio', ?, datetime('now'))",
      [memId, fact],
    );
    actionsExecuted.push({
      type: 'memory_saved',
      label: `Conocimiento guardado en Turso: "${fact}"`,
    });
    replyParts.push(`🧠 **¡Aprendido y guardado permanentemente en mi base de datos!**\nHe registrado la regla: *"${fact}"*. La tendré presente en todas las operaciones del panel.`);
  }

  // =========================================================================
  // INTENCIÓN 2: CREAR CATEGORÍA PERSONALIZADA
  // =========================================================================
  const newCatMatch = userMessage.match(/(?:crea|anade|añade|agrega|registra)\s+(?:una\s+)?(?:nueva\s+)?categoria\s+(?:de\s+)?(gasto|egreso|ingreso|ganancia)s?\s+(?:llamada\s+|con nombre\s+)?["']?([^"'.\n]+)["']?/i);
  if (newCatMatch) {
    const kind = /ingreso|ganancia/i.test(newCatMatch[1]) ? 'income' : 'expense';
    const label = newCatMatch[2].trim();
    const slug = slugifyCategory(label);
    const isRec = /fijo|mensual|recurrente/i.test(textLower) ? 'recurring' : 'one_time';
    const id = crmId();
    await execute(
      env,
      "INSERT OR REPLACE INTO custom_categories (id, kind, slug, label, frequency_default, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
      [id, kind, slug, label, isRec],
    );
    catLabels[slug] = label;
    actionsExecuted.push({
      type: 'category_created',
      label: `Categoría creada: ${label} (${kind === 'income' ? 'Ingreso' : 'Gasto'})`,
    });
    replyParts.push(`🏷️ He creado la categoría personalizada **${label}** (${kind === 'income' ? 'Ingreso' : 'Gasto'}) en Turso DB. Ya está disponible en todo el panel.`);
  }

  // =========================================================================
  // INTENCIÓN 3: ELIMINAR / DESHACER MOVIMIENTO
  // =========================================================================
  if (/(elimina|borra|quita|deshaz|anula)\s+(el\s+)?(ultimo\s+movimiento|ultimo\s+gasto|ultimo\s+ingreso|ultimo\s+cobro)/i.test(textLower)) {
    const targetKind = /gasto|egreso/.test(textLower) ? 'expense' : /ingreso|cobro/.test(textLower) ? 'income' : null;
    const candidate = movements.find((m) => !targetKind || m.kind === targetKind);
    if (candidate) {
      await execute(env, 'DELETE FROM movements WHERE id = ? OR linked_movement_id = ?', [candidate.id, candidate.id]);
      actionsExecuted.push({
        type: 'movement_deleted',
        label: `Eliminado: ${candidate.description || candidate.category} (${crmFormatUsd(candidate.amount_cents)})`,
      });
      replyParts.push(`🗑️ He eliminado de la base de datos el movimiento **${candidate.description || catLabels[candidate.category] || candidate.category}** por **${crmFormatUsd(candidate.amount_cents)}** del ${candidate.movement_date}.`);
    } else {
      replyParts.push(`⚠️ No encontré ningún movimiento reciente que coincida para eliminar.`);
    }
  }

  // =========================================================================
  // INTENCIÓN 4: CREAR UN NUEVO CLIENTE
  // =========================================================================
  const createClientMatch = userMessage.match(/(?:crea|anade|añade|agrega|registra)\s+(?:al\s+|un\s+)?(?:nuevo\s+)?cliente\s+["']?([A-Za-zÁÉÍÓÚáéíóúÑñ0-9 .&-]{2,50})["']?/i);
  if (createClientMatch) {
    let rawName = createClientMatch[1]
      .replace(/\s+(?:con\s+whatsapp|con\s+correo|con\s+telefono|whatsapp|correo|email|y\s+asignale|por\s+\$).*/i, '')
      .trim();
    if (rawName && rawName.length >= 2) {
      const emailMatch = userMessage.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      const phoneMatch = userMessage.match(/(?:\+?(\d{10,15}))/);
      const clientId = crmId();
      const emailVal = emailMatch ? emailMatch[1] : null;
      const waVal = phoneMatch ? phoneMatch[1] : null;
      await execute(
        env,
        "INSERT INTO clients (id, full_name, email, whatsapp_number, notes, is_active, updated_at) VALUES (?, ?, ?, ?, 'Creado por Asistente Do', 1, datetime('now'))",
        [clientId, rawName.toUpperCase(), emailVal, waVal],
      );
      const newClientObj = { id: clientId, full_name: rawName.toUpperCase(), email: emailVal, whatsapp_number: waVal };
      clients.unshift(newClientObj);
      actionsExecuted.push({
        type: 'client_created',
        label: `Cliente añadido: ${rawName.toUpperCase()}`,
      });
      replyParts.push(`👤 **¡Cliente registrado con éxito!**\nHe añadido a **${rawName.toUpperCase()}** en la base de datos${waVal ? ` (WhatsApp: ${waVal})` : ''}${emailVal ? ` (Email: ${emailVal})` : ''}.`);
    }
  }

  // =========================================================================
  // INTENCIÓN 5: REGISTRAR GASTO (ÚNICO O FIJO) O INGRESO / PAGO
  // =========================================================================
  const amountUsd = extractAmountUsd(userMessage);
  const isExpenseIntent =
    /\b(gasto|gastos|egreso|egresos|gaste|gastamos|pague|pagamos|compre|compramos|tuvimos que pagar|tuve que pagar|invertimos|imprevisto)\b/i.test(textLower) ||
    (!/\b(ingreso|ganancia|cobro|nos pago|cliente)\b/i.test(textLower) &&
      /\b(recarga|creditos?\s+ia|tokens?|etiquetas?\s+nfc|publicidad|ads)\b/i.test(textLower));

  const isIncomeIntent =
    !isExpenseIntent &&
    (/(registra|anade|añade|agrega|anota|marca)\b.*\b(ingreso|ganancia|cobro|pago|venta|abono)/i.test(textLower) ||
      /\b(ingreso|ganancia|cobro|cobramos|ganamos|nos pago|pago|abono|venta)\b.*(?:\$|\d)/i.test(textLower));

  if (amountUsd && (isExpenseIntent || isIncomeIntent)) {
    const kind = isExpenseIntent ? 'expense' : 'income';
    const frequency = /(fijo|mensual|recurrente|todos los meses|suscripcion)/i.test(textLower) ? 'recurring' : 'one_time';
    const category = kind === 'expense' ? inferExpenseCategory(textLower) : inferIncomeCategory(textLower);
    const mentionedClient = findMentionedClient(textLower);
    const amountCents = Math.round(amountUsd * 100);
    const movId = crmId();
    const today = crmToday();

    // Limpiar descripción legible
    let desc = userMessage
      .replace(/^(?:do\s*,?\s*)?(?:por favor\s*)?(?:registra|anade|añade|agrega|anota|coloca)\s+(?:un\s+)?(?:nuevo\s+)?(?:gasto|egreso|ingreso|ganancia|cobro|pago)\s*(?:unico|fijo|mensual)?\s*(?:de\s+\$?\d+(?:[.,]\d+)?\s*(?:usd|dolares|\$)?\s*)?(?:por|porque|de|para)?\s*/i, '')
      .trim();
    if (!desc || desc.length < 3) {
      desc = `${catLabels[category] || category}${mentionedClient ? ` — ${mentionedClient.full_name}` : ''}`;
    } else {
      desc = desc.charAt(0).toUpperCase() + desc.slice(1, 180);
    }

    await execute(
      env,
      `INSERT INTO movements (id, kind, category, frequency, amount_cents, description, movement_date, client_id, is_shared_profit, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, datetime('now'))`,
      [movId, kind, category, frequency, amountCents, desc, today, mentionedClient ? mentionedClient.id : null, String(auth.admin.id)],
    );

    // Actualizar array en memoria para que el cálculo inferior ya incluya este movimiento
    movements.unshift({
      id: movId,
      kind,
      category,
      frequency,
      amount_cents: amountCents,
      description: desc,
      movement_date: today,
      client_id: mentionedClient ? mentionedClient.id : null,
      client_name: mentionedClient ? mentionedClient.full_name : null,
    });

    const freqLabel = frequency === 'recurring' ? 'Fijo / Mensual' : 'Único por el momento';
    actionsExecuted.push({
      type: kind === 'expense' ? 'expense_created' : 'income_created',
      label: `${kind === 'expense' ? 'Gasto' : 'Ingreso'} (${freqLabel}): ${crmFormatUsd(amountCents)} — ${catLabels[category] || category}`,
    });

    replyParts.push(
      `${kind === 'expense' ? '💸 **¡Gasto registrado en Turso DB!**' : '💰 **¡Ingreso registrado en Turso DB!**'}\n` +
        `- **Concepto:** ${desc}\n` +
        `- **Monto:** ${crmFormatUsd(amountCents)} USD\n` +
        `- **Categoría:** ${catLabels[category] || category}\n` +
        `- **Modalidad:** ${freqLabel}` +
        (mentionedClient ? `\n- **Cliente vinculado:** ${mentionedClient.full_name}` : ''),
    );
  }

  // =========================================================================
  // INTENCIÓN 6: MARCAR COBRO PENDIENTE COMO PAGADO SIN MONTO EXPLÍCITO
  // =========================================================================
  if (!amountUsd && /(marca|registra)\s+como\s+pagado/i.test(textLower)) {
    const mentionedClient = findMentionedClient(textLower);
    if (mentionedClient) {
      const clientSvc = services.find((s) => s.client_id === mentionedClient.id);
      if (clientSvc) {
        const movId = crmId();
        const today = crmToday();
        const cat = CRM_SERVICE_TO_CATEGORY[clientSvc.service_type] || 'web_sale';
        await execute(
          env,
          `INSERT INTO movements (id, kind, category, frequency, amount_cents, description, movement_date, client_id, client_service_id, created_by, updated_at)
           VALUES (?, 'income', ?, 'recurring', ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [movId, cat, clientSvc.amount_cents, `Pago — ${clientSvc.service_type}`, today, mentionedClient.id, clientSvc.id, String(auth.admin.id)],
        );
        if (clientSvc.membership_id) {
          const nextDue = crmNextDue(clientSvc.billing_day || 1);
          await execute(
            env,
            "UPDATE memberships SET last_payment_date = ?, next_due_date = ?, status = 'al_dia', updated_at = datetime('now') WHERE id = ?",
            [today, nextDue, clientSvc.membership_id],
          );
        }
        actionsExecuted.push({
          type: 'payment_marked',
          label: `Cobro pagado: ${mentionedClient.full_name} (${crmFormatUsd(clientSvc.amount_cents)})`,
        });
        replyParts.push(`✅ He marcado como pagado el servicio de **${mentionedClient.full_name}** por **${crmFormatUsd(clientSvc.amount_cents)} USD** y actualizado su fecha de próximo vencimiento.`);
      }
    }
  }

  // =========================================================================
  // CÁLCULO ANALÍTICO EN TIEMPO REAL SOBRE TODA LA BASE DE DATOS
  // =========================================================================
  let monthIncome = 0;
  let monthExpense = 0;
  let totalIncomeAllTime = 0;
  let totalExpenseAllTime = 0;
  const paidByClient = new Map();
  const expenseByCat = new Map();
  const incomeByCat = new Map();

  for (const m of movements) {
    const amt = num(m.amount_cents, 0);
    const inThisMonth = m.movement_date >= monthFrom && m.movement_date <= monthTo;
    if (m.kind === 'income') {
      totalIncomeAllTime += amt;
      if (inThisMonth) monthIncome += amt;
      if (m.client_id) {
        paidByClient.set(m.client_id, (paidByClient.get(m.client_id) || 0) + amt);
      }
      incomeByCat.set(m.category, (incomeByCat.get(m.category) || 0) + amt);
    } else {
      totalExpenseAllTime += amt;
      if (inThisMonth) monthExpense += amt;
      expenseByCat.set(m.category, (expenseByCat.get(m.category) || 0) + amt);
    }
  }

  // Si no se ejecutó ninguna acción de escritura o si el usuario también hizo una pregunta, generamos respuesta analítica
  const mentionedClientForQuery = findMentionedClient(textLower);

  if (replyParts.length === 0) {
    if (mentionedClientForQuery && /(cuanto|pagado|pago|movimiento|historial|debe|info|estado|cliente)/i.test(textLower)) {
      const c = mentionedClientForQuery;
      const clientMovs = movements.filter((m) => m.client_id === c.id && m.kind === 'income');
      const totalPaid = paidByClient.get(c.id) || 0;
      const clientSvcs = services.filter((s) => s.client_id === c.id);
      const movList = clientMovs.length
        ? clientMovs.map((m) => `  • **${crmFormatUsd(m.amount_cents)}** — ${m.description || catLabels[m.category] || m.category} (${m.movement_date})`).join('\n')
        : '  • Aún no registra pagos individuales.';
      const svcList = clientSvcs.length
        ? clientSvcs.map((s) => `  • ${ s.service_type } (${crmFormatUsd(s.amount_cents)} · ${s.payment_kind === 'recurring' ? 'Mensual' : 'Único'})`).join('\n')
        : '  • Sin servicios recurrentes activos.';

      replyParts.push(
        `📊 **Ficha en vivo de ${c.full_name}:**\n` +
          `- **Total histórico pagado a VENDO:** **${crmFormatUsd(totalPaid)} USD**\n` +
          `- **Contacto:** ${c.email || c.whatsapp_number || 'No registrado'}\n\n` +
          `**Historial de pagos (${clientMovs.length}):**\n${movList}\n\n` +
          `**Servicios asociados:**\n${svcList}`,
      );
    } else if (/(clientes|cada cliente|quienes son|lista de clientes|cuanto pago cada)/i.test(textLower)) {
      const lines = clients.map((c) => {
        const paid = paidByClient.get(c.id) || 0;
        return `• **${c.full_name}**: ${crmFormatUsd(paid)} USD pagados`;
      });
      replyParts.push(
        `👥 **Estado de Clientes en la Base de Datos (${clients.length} registrados):**\n\n` +
          lines.join('\n') +
          `\n\n💰 **Facturación histórica acumulada:** **${crmFormatUsd(totalIncomeAllTime)} USD**.`,
      );
    } else if (/(gasto|egreso|en que se gasto|cuanto gastamos)/i.test(textLower)) {
      const expMovs = movements.filter((m) => m.kind === 'expense');
      const expLines = expMovs.length
        ? expMovs.slice(0, 12).map((m) => `• **${crmFormatUsd(m.amount_cents)}** (${m.frequency === 'recurring' ? '🔁 Fijo' : '⚡ Único'}) — ${m.description || catLabels[m.category] || m.category} [${m.movement_date}]`).join('\n')
        : '• No hay gastos registrados todavía.';
      replyParts.push(
        `💸 **Análisis de Gastos (Egresos) en Turso DB:**\n` +
          `- **Gastos de este mes:** **${crmFormatUsd(monthExpense)} USD**\n` +
          `- **Gastos históricos totales:** **${crmFormatUsd(totalExpenseAllTime)} USD**\n\n` +
          `**Últimos gastos registrados:**\n${expLines}\n\n` +
          `💡 *Tip: Puedes decirme "Registra un gasto único de $10 por créditos de IA" o "Añade un gasto fijo de $19 de suscripción" y lo guardaré al instante.*`,
      );
    } else {
      // Reporte ejecutivo integral por defecto
      const netMonth = monthIncome - monthExpense;
      const netAllTime = totalIncomeAllTime - totalExpenseAllTime;
      const topClients = clients
        .map((c) => ({ name: c.full_name, paid: paidByClient.get(c.id) || 0 }))
        .filter((x) => x.paid > 0)
        .sort((a, b) => b.paid - a.paid)
        .slice(0, 5)
        .map((x) => `• **${x.name}**: ${crmFormatUsd(x.paid)}`)
        .join('\n') || '• Sin pagos registrados aún.';

      const memNote = memories.length
        ? `\n\n🧠 **Reglas activas en mi memoria (${memories.length}):**\n` + memories.slice(0, 3).map((m) => `• *${m.content}*`).join('\n')
        : '';

      replyParts.push(
        `🤖 **Hola, soy Do · Tu Asistente Operativo conectado en vivo a Turso DB.**\n\n` +
          `📈 **Balance de este mes (${monthFrom.slice(0, 7)}):**\n` +
          `- **Ingresos del mes:** +${crmFormatUsd(monthIncome)} USD\n` +
          `- **Gastos del mes:** −${crmFormatUsd(monthExpense)} USD\n` +
          `- **Ganancia neta del mes:** **${crmFormatUsd(netMonth)} USD**\n\n` +
          `🏛️ **Histórico General en Base de Datos:**\n` +
          `- **Ingresos totales:** ${crmFormatUsd(totalIncomeAllTime)} USD | **Gastos totales:** ${crmFormatUsd(totalExpenseAllTime)} USD | **Neto:** **${crmFormatUsd(netAllTime)} USD**\n` +
          `- **Clientes activos (${clients.length}):**\n${topClients}` +
          memNote +
          `\n\n⚡ **¿Qué deseas que haga por ti ahora?**\n` +
          `Puedes ordenarme: *"Registra un gasto único de $10 por créditos de tokens"*, *"Registra un ingreso de $100 de Kimtoug"*, *"Añade al cliente X"*, o *"Recuerda que..."*`,
      );
    }
  }

  const finalReply = replyParts.join('\n\n');

  // Guardar conversación en Turso DB
  await batch(env, [
    {
      sql: "INSERT INTO do_chat_messages (id, role, content, actions_json, created_at) VALUES (?, 'user', ?, NULL, datetime('now'))",
      args: [crmId(), userMessage],
    },
    {
      sql: "INSERT INTO do_chat_messages (id, role, content, actions_json, created_at) VALUES (?, 'assistant', ?, ?, datetime('now'))",
      args: [crmId(), finalReply, actionsExecuted.length ? JSON.stringify(actionsExecuted) : null],
    },
  ]);

  return respond({
    ok: true,
    reply: finalReply,
    actions: actionsExecuted,
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
      headers: { Allow: 'GET, POST, PUT, DELETE, OPTIONS', 'Cache-Control': 'no-store' },
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
