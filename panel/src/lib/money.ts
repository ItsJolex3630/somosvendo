export const toCents = (usd: number): number => Math.round(usd * 100);

export const toUsd = (cents: number): number => cents / 100;

export const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

/** Formatea centavos con signo explícito para listados de movimientos. */
export const formatUsdSigned = (cents: number, kind: "income" | "expense"): string => {
  const sign = kind === "income" ? "+" : "−";
  return `${sign}${formatUsd(Math.abs(cents))}`;
};

/** Parsea un monto ingresado en USD (string o number) a centavos. Devuelve null si es inválido. */
export function parseUsdToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const normalized = String(input).replace(/[^0-9.,-]/g, "").replace(",", ".");
  if (normalized.trim() === "") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** Redondea un porcentaje a 2 decimales. */
export const roundPct = (value: number): number => Math.round(value * 100) / 100;

/** Parte del socio: se redondea sobre el gasto para que Vendo nunca pierda centavos. */
export function partnerCents(totalCents: number, vendoPct: number): number {
  return Math.round((totalCents * (100 - vendoPct)) / 100);
}
