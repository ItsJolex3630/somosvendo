"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ClientFormDefaults = {
  id?: string;
  fullName?: string;
  email?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
  isActive?: number;
};

export function ClientForm({
  action,
  defaults,
  mode,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaults?: ClientFormDefaults;
  mode: "create" | "edit";
}) {
  return (
    <form action={action} className="space-y-4">
      {defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo *</Label>
        <Input id="full_name" name="full_name" defaultValue={defaults?.fullName ?? ""} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp">WhatsApp (solo dígitos con código país)</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            placeholder="584121234567"
            defaultValue={defaults?.whatsapp ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} />
      </div>

      {mode === "edit" ? (
        <div className="space-y-2">
          <Label htmlFor="is_active">Estado</Label>
          <Select id="is_active" name="is_active" defaultValue={String(defaults?.isActive ?? 1)}>
            <option value="1">Activo</option>
            <option value="0">Inactivo</option>
          </Select>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit">{mode === "edit" ? "Guardar cambios" : "Crear cliente"}</Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
