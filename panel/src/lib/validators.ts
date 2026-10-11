export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

export const isValidWhatsapp = (value: string): boolean => /^[0-9]{8,15}$/.test(value);

export function normalizeWhatsapp(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  return digits.length ? digits : null;
}

export function s(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export function optionalS(form: FormData, key: string): string | null {
  const value = s(form, key);
  return value === "" ? null : value;
}

export function int(form: FormData, key: string, fallback = 0): number {
  const value = Number.parseInt(s(form, key), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function float(form: FormData, key: string, fallback = 0): number {
  const value = Number.parseFloat(s(form, key).replace(",", "."));
  return Number.isFinite(value) ? value : fallback;
}

export function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}
