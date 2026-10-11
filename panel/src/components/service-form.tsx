"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  PAYMENT_KIND_LABELS,
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/lib/constants";

export type ServiceFormDefaults = {
  id?: string;
  serviceType?: string;
  paymentKind?: string;
  amount?: string;
  status?: string;
  startDate?: string;
  billingDay?: number;
};

export function ServiceForm({
  action,
  clientId,
  defaults,
  mode,
}: {
  action: (formData: FormData) => void | Promise<void>;
  clientId: string;
  defaults?: ServiceFormDefaults;
  mode: "create" | "edit";
}) {
  const [paymentKind, setPaymentKind] = useState(defaults?.paymentKind ?? "one_time");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="client_id" value={clientId} />
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="service_type">Tipo de servicio</Label>
          <Select
            id="service_type"
            name="service_type"
            defaultValue={defaults?.serviceType ?? "hosting"}
          >
            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_kind">Forma de pago</Label>
          <Select
            id="payment_kind"
            name="payment_kind"
            value={paymentKind}
            onChange={(e) => setPaymentKind(e.target.value)}
          >
            {Object.entries(PAYMENT_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Precio pactado (USD)</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="15.00"
            defaultValue={defaults?.amount ?? ""}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={defaults?.status ?? "active"}>
            {Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="start_date">Fecha de inicio</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={defaults?.startDate} />
        </div>

        {paymentKind === "recurring" ? (
          <div className="space-y-2">
            <Label htmlFor="billing_day">Día de cobro (1–28)</Label>
            <Input
              id="billing_day"
              name="billing_day"
              type="number"
              min={1}
              max={28}
              defaultValue={defaults?.billingDay ?? 1}
            />
          </div>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button type="submit">{mode === "edit" ? "Guardar cambios" : "Agregar servicio"}</Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
