import Link from "next/link";
import { notFound } from "next/navigation";
import { createService, deleteClient, deleteService } from "@/app/actions/clients";
import { ServiceForm } from "@/components/service-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MEMBERSHIP_STATUS_LABELS,
  PAYMENT_KIND_LABELS,
  SERVICE_STATUS_LABELS,
  serviceTypeLabel,
} from "@/lib/constants";
import { getClientDetail, listMovements } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { formatUsd, formatUsdSigned } from "@/lib/money";
import { cn } from "@/lib/utils";

export default async function ClienteDetailPage({ params }: { params: { id: string } }) {
  const client = await getClientDetail(params.id);
  if (!client) notFound();

  const payments = await listMovements({ clientId: params.id });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">{client.fullName}</h1>
            {client.isEntrepreneur ? <Badge>Emprendedor</Badge> : null}
            {client.isActive ? null : <Badge variant="muted">Inactivo</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {client.email ?? "sin correo"} · {client.whatsappNumber ?? "sin WhatsApp"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/clientes/${client.id}/editar`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Editar
          </Link>
          <form action={deleteClient}>
            <input type="hidden" name="id" value={client.id} />
            <ConfirmButton
              variant="ghost"
              size="sm"
              message="¿Eliminar este cliente y todos sus datos? Esta acción no se puede deshacer."
            >
              Eliminar
            </ConfirmButton>
          </form>
        </div>
      </div>

      {client.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Notas</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{client.notes}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Servicios contratados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servicio</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Próximo cobro</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {client.services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sin servicios todavía.
                  </TableCell>
                </TableRow>
              ) : (
                client.services.map((svc) => (
                  <TableRow key={svc.id}>
                    <TableCell className="font-medium">{serviceTypeLabel(svc.serviceType)}</TableCell>
                    <TableCell>{formatUsd(svc.amountCents)}</TableCell>
                    <TableCell>{PAYMENT_KIND_LABELS[svc.paymentKind]}</TableCell>
                    <TableCell>
                      <Badge variant={svc.status === "active" ? "success" : "muted"}>
                        {SERVICE_STATUS_LABELS[svc.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {svc.nextDueDate ? (
                        <span>
                          {formatDate(svc.nextDueDate)}{" "}
                          {svc.membershipStatus ? (
                            <span className="text-xs text-muted-foreground">
                              ({MEMBERSHIP_STATUS_LABELS[svc.membershipStatus]})
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/pagos/nuevo?clientServiceId=${svc.id}&redirect_to=/clientes/${client.id}`}
                          className={cn(buttonVariants({ size: "sm" }))}
                        >
                          Registrar pago
                        </Link>
                        <Link
                          href={`/clientes/${client.id}/servicios/${svc.id}/editar`}
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        >
                          Editar
                        </Link>
                        <form action={deleteService}>
                          <input type="hidden" name="id" value={svc.id} />
                          <ConfirmButton
                            variant="ghost"
                            size="sm"
                            message="¿Eliminar este servicio?"
                          >
                            Eliminar
                          </ConfirmButton>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar servicio</CardTitle>
        </CardHeader>
        <CardContent>
          <ServiceForm action={createService} clientId={client.id} mode="create" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Sin movimientos.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{formatDate(m.movementDate)}</TableCell>
                    <TableCell>
                      <Badge variant={m.kind === "income" ? "success" : "destructive"}>
                        {m.kind === "income" ? "Ingreso" : "Gasto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.description ?? "—"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        m.kind === "income" ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatUsdSigned(m.amountCents, m.kind)}
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
