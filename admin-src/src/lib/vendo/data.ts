// Tipos y helpers del panel VENDO conectados a /api/admin/crm y Turso DB.

export type TransactionStatus = 'Completado' | 'Pendiente' | 'Vencido';
export type TransactionType = 'Ingreso' | 'Egreso';
export type MovementFrequency = 'one_time' | 'recurring';

export type ClientService = {
  id: string;
  serviceType: string;
  serviceLabel: string;
  paymentKind: string;
  amountCents: number;
  nextDueDate: string | null;
  status: string | null;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  email: string;
  whatsapp: string;
  service: string;
  initials: string;
  tone: string;
  status: string;
  isEntrepreneur: boolean;
  services: ClientService[];
};

export type Transaction = {
  id: string;
  clientId: string;
  clientName: string;
  description: string;
  category: string;
  service: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  type: TransactionType;
  frequency: MovementFrequency;
};

export type Movement = {
  id: string;
  kind: 'income' | 'expense';
  category: string;
  frequency?: MovementFrequency;
  amount_cents: number;
  description: string | null;
  movement_date: string;
  client_id: string | null;
  client_name: string | null;
};

export type CustomCategory = {
  id: string;
  kind: 'income' | 'expense';
  slug: string;
  label: string;
  frequency_default: MovementFrequency;
};

export type DoActionExecuted = {
  type: string;
  label: string;
};

export type DoChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: DoActionExecuted[];
  created_at: string;
};

export type DoMemoryItem = {
  id: string;
  topic: string;
  content: string;
  created_at: string;
};

export type Summary = { income_cents: number; expense_cents: number; net_cents: number };
export type SeriesPoint = { month: string; income_cents: number; expense_cents: number; net_cents: number };
export type CategoryTotal = { category: string; total_cents: number };
export type SummaryResponse = {
  summary: Summary;
  series: SeriesPoint[];
  income_by_category: CategoryTotal[];
  expense_by_category: CategoryTotal[];
};

export type Cobro = {
  membership_id: string;
  client_service_id: string;
  client_id: string;
  client_name: string;
  whatsapp_number: string | null;
  email: string | null;
  service_type: string;
  amount_cents: number;
  billing_day: number;
  start_date: string;
  next_due_date: string;
  last_payment_date: string | null;
  status: string;
  days_overdue: number;
  days_until: number;
  whatsapp_url: string;
};

export type Alert = { type: string; membership_id?: string; message: string };

export type ApiSettings = {
  photography_vendo_pct: string | number;
  branding_vendo_pct: string | number;
  days_before_due_warning: string | number;
  days_overdue_to_suspend: string | number;
  whatsapp_reminder_template: string;
  email_reminder_subject: string;
  email_reminder_template: string;
};

export type AuditRow = { id: string; table_name: string; record_id: string; action: string; created_at: string; user_name: string | null };

export const CATEGORY_LABELS: Record<string, string> = {
  // Ingresos
  web_sale: 'Venta / Desarrollo Web',
  hosting_monthly: 'Hosting & Dominio Mensual',
  vendo_conecta_monthly: 'VÉNDO Conecta (Fidelización)',
  feature_implementation: 'Implementación / Mejoras Web',
  photography: 'Sesión Fotográfica (Ali Gómez)',
  branding: 'Creación de Marca / Diseño',
  subscription: 'Suscripción / Retainer Mensual',
  google_maps: 'Posicionamiento Google Maps',
  custom_income: 'Ganancia Única / Personalizada',
  // Egresos (Gastos fijos y únicos)
  ai_credits: 'Créditos IA / Tokens Extra',
  software_sub: 'Suscripción Software / IA (Fijo)',
  advertising: 'Publicidad & Ads (Meta/Google)',
  nfc_reinvestment: 'Compra de Etiquetas / Tarjetas NFC',
  domains_servers: 'Dominios & Servidores',
  partner_payout: 'Pago a Socio / Comisión',
  unexpected: 'Gasto Único / Imprevisto del Momento',
  savings: 'Ahorro / Fondo de Reserva',
  custom_expense: 'Gasto Personalizado',
};

export const SERVICE_LABELS: Record<string, string> = {
  web_dev: 'Desarrollo web',
  hosting: 'Hosting',
  vendo_conecta: 'Vendo Conecta',
  nfc_cards: 'Tarjetas NFC',
  photography: 'Sesión fotográfica',
  branding: 'Creación de marca',
  feature_implementation: 'Implementación',
  google_maps: 'Google Maps',
};

export const INCOME_CATEGORIES = [
  'web_sale',
  'hosting_monthly',
  'vendo_conecta_monthly',
  'google_maps',
  'feature_implementation',
  'photography',
  'branding',
  'subscription',
  'custom_income',
];

export const EXPENSE_CATEGORIES = [
  'ai_credits',
  'software_sub',
  'advertising',
  'nfc_reinvestment',
  'domains_servers',
  'unexpected',
  'partner_payout',
  'savings',
  'custom_expense',
];

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
export const SERVICE_TYPES = Object.keys(SERVICE_LABELS);
export const SERVICES = INCOME_CATEGORIES.slice(0, 4).map((c) => CATEGORY_LABELS[c] ?? c);

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  al_dia: 'Activo',
  proximo_a_vencer: 'Próximo',
  vencido: 'Vencido',
  suspendido: 'Suspendido',
};

export const TONES = ['lime', 'teal', 'sand', 'blue', 'rose'];

export function categoryLabel(category: string, customCategories?: CustomCategory[]): string {
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  const found = customCategories?.find((c) => c.slug === category);
  if (found) return found.label;
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function serviceLabel(serviceType: string): string {
  return SERVICE_LABELS[serviceType] || serviceType;
}

export function serviceToCategory(serviceType: string): string {
  const map: Record<string, string> = {
    web_dev: 'web_sale',
    hosting: 'hosting_monthly',
    vendo_conecta: 'vendo_conecta_monthly',
    nfc_cards: 'feature_implementation',
    feature_implementation: 'feature_implementation',
    photography: 'photography',
    branding: 'branding',
    google_maps: 'google_maps',
  };
  return map[serviceType] || 'web_sale';
}

export function toneFor(index: number): string {
  return TONES[index % TONES.length];
}

export function initialsOf(name: string): string {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '—'
  );
}

export function money(value: number, _currency?: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(value) || 0);
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function shortDate(date: string): string {
  const iso = String(date || '').slice(0, 10);
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date || '';
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportCsv(transactions: Transaction[], _clients?: Client[]): void {
  const cell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ['ID', 'Cliente', 'Concepto', 'Categoría', 'Frecuencia', 'Importe (USD)', 'Fecha', 'Tipo'],
    ...transactions.map((t) => [
      t.id,
      t.clientName,
      t.description,
      t.service,
      t.frequency === 'recurring' ? 'Fijo / Mensual' : 'Único',
      t.amount.toFixed(2),
      t.date,
      t.type,
    ]),
  ];
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vendo-movimientos.csv';
  a.click();
  URL.revokeObjectURL(url);
}
