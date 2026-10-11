export class ApiError extends Error {
  constructor(status, message, data) {
    super(message || `Error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e inténtalo de nuevo.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data && data.error) || `Error ${res.status}`, data);
  }
  return data;
}

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

export function money(amount, currency = 'USD') {
  const n = Number(amount) || 0;
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;
  const value = Number.isInteger(n) ? n : n.toFixed(2);
  return `${symbol}${value}`;
}

export function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

export function parseDbDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  const iso = s.includes('T') ? s : `${s.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function timeAgo(value) {
  const d = parseDbDate(value);
  if (!d) return '';
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'hace unos segundos';
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `hace ${days} d`;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDate(value) {
  const d = parseDbDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function waLink(phone, text = '') {
  let p = digits(phone);
  if (!p) return '';
  if (p.startsWith('0')) p = `58${p.slice(1)}`;
  else if (p.length === 10) p = `58${p}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${p}${query}`;
}

export async function copyText(text) {
  const value = String(text == null ? '' : text);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

let toastHost = null;
export function toast(message, type = 'info', ms = 3200) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const node = el('div', { class: `toast toast--${type}`, text: message });
  toastHost.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s ease';
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 260);
  }, ms);
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export const STATUS = {
  activo: { label: 'Activo', cls: 'status--activo' },
  gracia: { label: 'En gracia', cls: 'status--gracia' },
  vencido: { label: 'Vencido', cls: 'status--vencido' },
  pendiente: { label: 'Pendiente', cls: 'status--pendiente' },
  rechazado: { label: 'Rechazado', cls: 'status--rechazado' },
};

export function statusMeta(estado) {
  return STATUS[estado] || { label: estado || '—', cls: 'status--pendiente' };
}

function parseHex(hex) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 3 && clean.length !== 6) return null;
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function luminance({ r, g, b }) {
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function applyTenantTheme(club) {
  const root = document.documentElement;
  const colors = (club && club.colores) || {};
  const primary = colors.primario || '#cef17b';
  const secondary = colors.secundario || '#01442c';
  const bg = colors.fondo || '#01110a';
  const parsed = parseHex(bg);
  const light = parsed ? luminance(parsed) > 0.5 : false;
  root.style.setProperty('--t-primary', primary);
  root.style.setProperty('--t-secondary', secondary);
  root.style.setProperty('--t-bg', bg);
  root.style.setProperty('--t-ink', light ? '#0b1a12' : '#f8ffe6');
  root.style.setProperty('--t-muted', light ? 'rgba(11,26,18,.6)' : '#a9c2a0');
  root.style.setProperty('--t-card', `color-mix(in srgb, ${secondary} 24%, ${bg})`);
  root.style.setProperty('--t-line', `color-mix(in srgb, ${primary} 22%, transparent)`);
  const meta = qs('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);
}

export function detectTenantSlug(fallback = 'masafacil') {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('t') || params.get('tenant') || params.get('club');
  const fromHash = window.location.hash ? window.location.hash.replace(/^#\/?/, '') : '';
  const raw = (fromQuery || fromHash || '').trim().toLowerCase();
  const clean = raw.replace(/[^a-z0-9-]/g, '');
  return clean || fallback;
}
