"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CATEGORY_LABELS,
  INCOME_CATEGORIES,
  SHARED_PROFIT_CATEGORIES,
  categoryLabel,
} from "@/lib/constants";
import { formatUsd, parseUsdToCents } from "@/lib/money";

export function PaymentForm({
  action,
  clientServiceId,
  clientName,
  serviceLabel,
  defaultAmount,
  defaultCategory,
  redirectTo,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clientServiceId: string;
  clientName: string;
  serviceLabel: string;
  defaultAmount: string;
  defaultCategory: string;
  redirectTo: string;
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [amount, setAmount] = useState(defaultAmount);
  const [pct, setPct] = useState("50");

  const isShared = SHARED_PROFIT_CATEGORIES.includes(category as never);

  const preview = useMemo(() => {
    const cents = parseUsdToCents(amount) ?? 0;
    const vendoPct = Number(pct) || 0;
    const vendoCents = Math.round((cents * vendoPct) / 100);
    return { vendoCents, partnerCents: cents - vendoCents };
  }, [amount, pct]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="client_service_id" value={clientServiceId} />
      <input type="hidden" name="redirect_to" value={redirectTo} />

      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{serviceLabel}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Categoría del ingreso</Label>
          <Select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {INCOME_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Monto (USD)</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Fecha del pago</Label>
          <Input id="date" name="date" type="date" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input id="description" name="description" placeholder="Opcional" />
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
              Vendo recibe: <strong className="text-primary">{formatUsd(preview.vendoCents)}</strong>
            </span>
            <span>
              Socio recibe: <strong>{formatUsd(preview.partnerCents)}</strong>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Se registrará un gasto de «{categoryLabel("partner_payout")}» enlazado a este ingreso.
          </p>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit">Registrar pago</Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
