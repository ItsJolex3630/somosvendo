import { updateSettings } from "@/app/actions/settings";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { listAuditLog } from "@/lib/db/queries";
import { formatDateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";

const ACTION_VARIANT: Record<string, NonNullable<BadgeProps["variant"]>> = {
  create: "success",
  update: "warning",
  delete: "destructive",
};

const TABLE_LABELS: Record<string, string> = {
  clients: "Clientes",
  client_services: "Servicios",
  movements: "Movimientos",
  memberships: "Membresías",
  settings: "Ajustes",
};

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: { tableName?: string; userId?: string };
}) {
  const [settings, audit, userList] = await Promise.all([
    getSettings(),
    listAuditLog({ tableName: searchParams.tableName, userId: searchParams.userId }),
    db.select({ id: users.id, displayName: users.displayName }).from(users),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ganancias compartidas y parámetros de cobro</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="photography_vendo_pct">% Vendo en fotografía</Label>
                <Input
                  id="photography_vendo_pct"
                  name="photography_vendo_pct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={settings.photographyVendoPct}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branding_vendo_pct">% Vendo en creación de marca</Label>
                <Input
                  id="branding_vendo_pct"
                  name="branding_vendo_pct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={settings.brandingVendoPct}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_before_due_warning">Días de advertencia previa</Label>
                <Input
                  id="days_before_due_warning"
                  name="days_before_due_warning"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={settings.daysBeforeDueWarning}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_overdue_to_suspend">Días de mora para sugerir suspensión</Label>
                <Input
                  id="days_overdue_to_suspend"
                  name="days_overdue_to_suspend"
                  type="number"
                  min={0}
                  max={120}
                  defaultValue={settings.daysOverdueToSuspend}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_reminder_template">
                Plantilla WhatsApp (recordatorio amable)
              </Label>
              <Textarea
                id="whatsapp_reminder_template"
                name="whatsapp_reminder_template"
                rows={4}
                defaultValue={settings.whatsappReminderTemplate}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_reminder_subject">Asunto del correo</Label>
              <Input
                id="email_reminder_subject"
                name="email_reminder_subject"
                defaultValue={settings.emailReminderSubject}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email_reminder_template">Plantilla de correo</Label>
              <Textarea
                id="email_reminder_template"
                name="email_reminder_template"
                rows={5}
                defaultValue={settings.emailReminderTemplate}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Variables disponibles: <code>{"{nombre}"}</code> <code>{"{monto}"}</code>{" "}
              <code>{"{servicio}"}</code> <code>{"{fecha}"}</code> <code>{"{dias_mora}"}</code>.
            </p>

            <Button type="submit">Guardar ajustes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de cambios (audit log)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
            <Select name="tableName" defaultValue={searchParams.tableName ?? ""}>
              <option value="">Todas las tablas</option>
              {Object.entries(TABLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select name="userId" defaultValue={searchParams.userId ?? ""}>
              <option value="">Todos los administradores</option>
              {userList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Filtrar
            </Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Tabla</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin registros de auditoría.
                  </TableCell>
                </TableRow>
              ) : (
                audit.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>{row.userName ?? "Sistema"}</TableCell>
                    <TableCell>{TABLE_LABELS[row.tableName] ?? row.tableName}</TableCell>
                    <TableCell>
                      <Badge variant={ACTION_VARIANT[row.action] ?? "muted"}>{row.action}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.recordId}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
