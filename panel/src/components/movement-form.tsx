"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORY_LABELS,
  INCOME_CATEGORIES,
  SELECTABLE_EXPENSE_CATEGORIES,
  SHARED_PROFIT_CATEGORIES,
  categoryLabel,
} from "@/lib/constants";
import { formatUsd, parseUsdToCents } from "@/lib/money";

type ClientOption = { id: string; fullName: string };

export type MovementFormDefaults = {
  id?: string;
  kind?: "income" | "expense";
  category?: string;
  amount?: string;
  date?: string;
  description?: string;
  clientId?: string | null;
  clientServiceId?: string | null;
  vendoSharePct?: number | null;
};

export function MovementForm({
  action,
  clients,
  defaults,
  mode,
  lockedKind,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clients: ClientOption[];
  defaults?: MovementFormDefaults;
  mode: "create" | "edit";
  lockedKind?: boolean;
}) {
  const [kind, setKind] = useState<"income" | "expense">(defaults?.kind ?? "income");
  const [category, setCategory] = useState(defaults?.category ?? "web_sale");
  const [amount, setAmount] = useState(defaults?.amount ?? "");
  const [pct, setPct] = useState(String(defaults?.vendoSharePct ?? 50));

  const categories = kind === "income" ? INCOME_CATEGORIES : SELECTABLE_EXPENSE_CATEGORIES;
  const isShared = kind === "income" && SHARED_PROFIT_CATEGORIES.includes(category as never);

  const preview = useMemo(() => {
    const cents = parseUsdToCents(amount) ?? 0;
    const vendoPct = Number(pct) || 0;
    const vendoCents = Math.round((cents * vendoPct) / 100);
    return { vendoCents, partnerCents: cents - vendoCents };
  }, [amount, pct]);

  function onKindChange(next: "income" | "expense") {
    setKind(next);
    const options = next === "income" ? INCOME_CATEGORIES : SELECTABLE_EXPENSE_CATEGORIES;
    if (!options.includes(category as never)) setCategory(options[0]);
  }

  return (
    <form action={action} className="space-y-5">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {defaults?.clientServiceId ? (
        <input type="hidden" name="client_service_id" value={defaults.clientServiceId} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kind">Tipo</Label>
          <Select
            id="kind"
            name="kind"
            value={kind}
            disabled={mode === "edit" || lockedKind}
            onChange={(e) => onKindChange(e.target.value as "income" | "expense")}
          >
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select
            id="category"
            name="category"
            value={category}
            disabled={mode === "edit"}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          {mode === "edit" ? (
            <input type="hidden" name="category" value={category} />
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto (USD)</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="100.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" defaultValue={defaults?.date} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="client_id">Cliente (opcional)</Label>
          <Select id="client_id" name="client_id" defaultValue={defaults?.clientId ?? ""}>
            <option value="">— Sin cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={defaults?.description ?? ""}
            placeholder="Detalle del movimiento"
          />
        </div>
      </div>

      {isShared ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label htmlFor="vendo_share_pct">% que se queda Vendo</Label>
            <Input
              id="vendo_share_pct"
              name="vendo_share_pct"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span>
              Vendo recibe:{" "}
              <strong className="text-primary">{formatUsd(preview.vendoCents)}</strong>
            </span>
            <span>
              Socio recibe: <strong>{formatUsd(preview.partnerCents)}</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Se creará un gasto de «{categoryLabel("partner_payout")}» por la parte del socio,
            enlazado a este ingreso.
          </p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit">{mode === "edit" ? "Guardar cambios" : "Registrar movimiento"}</Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
