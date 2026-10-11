export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const todayIso = (): string => isoDate(new Date());

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const normalized = iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function daysOverdue(nextDue: string): number {
  const diff = daysBetween(nextDue, todayIso());
  return diff > 0 ? diff : 0;
}

export function daysUntilDue(nextDue: string): number {
  return daysBetween(todayIso(), nextDue);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return isoDate(d);
}

/**
 * Próxima fecha de cobro con día = billing_day.
 * Regla del spec: si hoy <= día de corte, es este mes; si no, el mes siguiente.
 * billing_day está limitado a 1..28, así que no hay problemas de fin de mes.
 */
export function nextDueDate(billingDay: number, from: Date = new Date()): string {
  const day = Math.min(Math.max(billingDay, 1), 28);
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  if (from.getUTCDate() > day) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return isoDate(new Date(Date.UTC(year, month, day)));
}

export const monthKey = (iso: string): string => iso.slice(0, 7);

export function startOfMonthIso(d = new Date()): string {
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

export function endOfMonthIso(d = new Date()): string {
  return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("es-VE", { month: "short", year: "2-digit", timeZone: "UTC" });
}
