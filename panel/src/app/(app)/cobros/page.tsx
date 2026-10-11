import Link from "next/link";
import { suspendMembership } from "@/app/actions/memberships";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MEMBERSHIP_STATUS_LABELS, serviceTypeLabel, type MembershipStatus } from "@/lib/constants";
import { listMembershipOverview } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { formatUsd } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { buildReminder, mailtoUrl, waUrl } from "@/lib/templates";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<MembershipStatus, NonNullable<BadgeProps["variant"]>> = {
  al_dia: "success",
  proximo_a_vencer: "warning",
  vencido: "destructive",
  suspendido: "muted",
};

export default async function CobrosPage() {
  const [rows, settings] = await Promise.all([listMembershipOverview(), getSettings()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Cobros recurrentes</h1>
        <p className="text-sm text-muted-foreground">
          Membresías ordenadas por urgencia. Aviso previo a {settings.daysBeforeDueWarning} días ·
          suspensión sugerida a los {settings.daysOverdueToSuspend} días de mora.
        </p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Próximo pago</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Mora</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No hay membresías. Crea un cliente con un servicio mensual para empezar.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const servicio = serviceTypeLabel(row.serviceType);
                  const kind = row.status === "vencido" ? "overdue" : "due_soon";
                  const reminder = buildReminder(
                    kind,
                    {
                      nombre: row.clientName,
                      montoCents: row.amountCents,
                      servicio,
                      fecha: row.nextDueDate,
                      diasMora: row.daysOverdue,
                    },
                    settings,
                  );
                  const wa = row.whatsappNumber ? waUrl(row.whatsappNumber, reminder.whatsapp) : null;
                  const mail = row.email
                    ? mailtoUrl(row.email, reminder.subject, reminder.body)
                    : null;

                  return (
                    <TableRow key={row.membershipId}>
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell>{servicio}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(row.startDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.nextDueDate)}
                      </TableCell>
                      <TableCell className="text-right">{formatUsd(row.amountCents)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status]}>
                          {MEMBERSHIP_STATUS_LABELS[row.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.daysOverdue > 0 ? (
                          <span className="font-medium text-destructive">{row.daysOverdue} d</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/pagos/nuevo?clientServiceId=${row.clientServiceId}&redirect_to=/cobros`}
                            className={cn(buttonVariants({ size: "sm" }))}
                          >
                            Registrar pago
                          </Link>
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                            >
                              WhatsApp
                            </a>
                          ) : null}
                          {mail ? (
                            <a
                              href={mail}
                              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                            >
                              Correo
                            </a>
                          ) : null}
                          {row.status === "vencido" ? (
                            <form action={suspendMembership}>
                              <input type="hidden" name="membership_id" value={row.membershipId} />
                              <ConfirmButton
                                variant="ghost"
                                size="sm"
                                message="¿Suspender este servicio? Se marcará la fecha de suspensión."
                              >
                                Suspender
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
