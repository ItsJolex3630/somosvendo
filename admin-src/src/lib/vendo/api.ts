// Cliente HTTP del panel. Patrón tomado del admin anterior
// (Website/assets/js/admin.js): Bearer desde sessionStorage + mismos endpoints.
import type {
  Alert,
  ApiSettings,
  AuditRow,
  CategoryTotal,
  ClientService,
  Cobro,
  CustomCategory,
  DoActionExecuted,
  DoChatMessage,
  DoMemoryItem,
  Movement,
  MovementFrequency,
  SeriesPoint,
  Summary,
} from './data';

const API_BASE = '/api/admin/crm';
export const TOKEN_KEY = 'vendo_admin_token';
export const EMAIL_KEY = 'vendo_admin_email';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredEmail(): string {
  try {
    return sessionStorage.getItem(EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function storeSession(token: string, email: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* noop */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
  } catch {
    /* noop */
  }
}

export function decodeEmail(jwt: string): string {
  try {
    const part = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = part.length % 4 ? '='.repeat(4 - (part.length % 4)) : '';
    const payload = JSON.parse(atob(part + pad));
    return payload.email || '';
  } catch {
    return '';
  }
}

type RequestOptions = { method?: string; body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(API_BASE + path, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet.');
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON */
  }
  const payload = (data || {}) as { error?: string };

  if (res.status === 401 || res.status === 403) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('vendo:unauthorized', { detail: { status: res.status, error: payload.error } }),
      );
    }
    throw new ApiError(res.status, payload.error || 'Sesión no válida');
  }
  if (!res.ok) throw new ApiError(res.status, payload.error || `Error ${res.status}`);
  return data as T;
}

const FALLBACK_GOOGLE_CLIENT_ID = '39780826399-626q7bsjaicc7fpa81ibqoffejmabvir.apps.googleusercontent.com';

export async function getGoogleClientId(): Promise<string | null> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return FALLBACK_GOOGLE_CLIENT_ID;
    const cfg = (await res.json()) as { google_client_id?: string | null };
    return cfg.google_client_id || FALLBACK_GOOGLE_CLIENT_ID;
  } catch {
    return FALLBACK_GOOGLE_CLIENT_ID;
  }
}

// ----------------------------- Queries -----------------------------

export async function fetchSummary(range = 'this_month') {
  return request<{ summary: Summary; series: SeriesPoint[]; income_by_category: CategoryTotal[]; expense_by_category: CategoryTotal[] }>(
    `/summary?range=${encodeURIComponent(range)}`,
  );
}

export type MovementsQuery = { kind?: string; category?: string; from?: string; to?: string; q?: string };
export async function fetchMovements(filters: MovementsQuery = {}) {
  const qs = new URLSearchParams();
  if (filters.kind) qs.set('kind', filters.kind);
  if (filters.category) qs.set('category', filters.category);
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.q) qs.set('q', filters.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<{ movements: Movement[] }>(`/movements${suffix}`);
}

export async function fetchClients(q = '') {
  const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
  return request<{
    clients: Array<{
      id: string;
      full_name: string;
      email: string | null;
      whatsapp_number: string | null;
      notes: string | null;
      is_active: number;
      services: Array<{
        id: string;
        client_id: string;
        service_type: string;
        payment_kind: string;
        amount_cents: number;
        status: string | null;
        next_due_date: string | null;
      }>;
      is_entrepreneur: boolean;
      worst_status: string | null;
    }>;
  }>(`/clients${suffix}`);
}

export async function fetchCobros() {
  return request<{ cobros: Cobro[]; warning_days: number }>('/cobros');
}

export async function fetchNotifications() {
  return request<{ count: number; alerts: Alert[] }>('/notifications');
}

export async function fetchSettings() {
  return request<{ settings: ApiSettings }>('/settings');
}

export async function fetchAudit() {
  return request<{ audit: AuditRow[] }>('/audit');
}

// ----------------------------- Mutations -----------------------------

export async function postMovement(body: {
  kind: 'income' | 'expense';
  category: string;
  frequency?: MovementFrequency;
  new_category_label?: string;
  amount_usd: number | string;
  date?: string;
  description?: string;
  client_id?: string;
}) {
  return request<{ movement_id: string; category: string }>('/movements', { method: 'POST', body });
}

export async function putMovement(
  id: string,
  body: {
    amount_usd?: number | string;
    date?: string;
    description?: string;
    category?: string;
    frequency?: MovementFrequency;
    client_id?: string | null;
  },
) {
  return request<{ ok: boolean; id: string; movement_date: string }>(`/movements/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body,
  });
}

export async function deleteMovement(id: string) {
  return request<{ ok: boolean }>(`/movements/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchCustomCategories() {
  return request<{ categories: CustomCategory[] }>('/categories');
}

export async function postCustomCategory(body: {
  kind: 'income' | 'expense';
  label: string;
  frequency_default?: MovementFrequency;
}) {
  return request<{ category: CustomCategory }>('/categories', { method: 'POST', body });
}

export async function deleteCustomCategory(id: string) {
  return request<{ ok: boolean }>(`/categories/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ----------------------------- Agente Do CRM -----------------------------

export async function fetchDoAgentState() {
  return request<{
    ok: boolean;
    messages: DoChatMessage[];
    memories: DoMemoryItem[];
    categories: CustomCategory[];
  }>('/agent/state');
}

export async function postDoAgentChat(message: string) {
  return request<{
    ok: boolean;
    reply: string;
    actions: DoActionExecuted[];
  }>('/agent/chat', { method: 'POST', body: { message } });
}

export async function postDoAgentMemory(content: string, topic = 'regla_negocio') {
  return request<{ ok: boolean; memory: DoMemoryItem }>('/agent/memory', {
    method: 'POST',
    body: { content, topic },
  });
}

export async function deleteDoAgentMemory(id: string) {
  return request<{ ok: boolean }>(`/agent/memory/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function clearDoAgentHistory() {
  return request<{ ok: boolean }>('/agent/history', { method: 'DELETE' });
}

export async function postClient(body: {
  full_name: string;
  email?: string;
  whatsapp_number?: string;
  notes?: string;
}) {
  return request<{ client_id: string }>('/clients', { method: 'POST', body });
}

export async function postClientService(
  clientId: string,
  body: { service_type: string; payment_kind: string; amount_usd: number | string; billing_day?: number },
) {
  return request<{ service_id: string }>(`/clients/${encodeURIComponent(clientId)}/services`, {
    method: 'POST',
    body,
  });
}

export async function postPayment(body: {
  client_service_id: string;
  amount_usd?: number | string;
  date?: string;
}) {
  return request<{ movement_id: string }>('/payments', { method: 'POST', body });
}

export async function putSettings(body: Partial<ApiSettings>) {
  return request<{ ok: boolean }>('/settings', { method: 'PUT', body });
}

export type { Cobro, ClientService };
