import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  SERVICE_TYPE_LABELS,
  serviceTypeLabel,
  type MembershipStatus,
} from "@/lib/constants";
import { listClients } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

const DOT: Record<MembershipStatus, string> = {
  al_dia: "bg-success",
  proximo_a_vencer: "bg-warning",
  vencido: "bg-destructive",
  suspendido: "bg-muted-foreground",
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; serviceType?: string };
}) {
  const rows = await listClients({ q: searchParams.q, serviceType: searchParams.serviceType });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Link href="/clientes/nuevo" className={cn(buttonVariants({ size: "sm" }))}>
          + Nuevo cliente
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" method="get">
            <Input name="q" placeholder="Buscar por nombre, correo o WhatsApp…" defaultValue={searchParams.q ?? ""} />
            <Select name="serviceType" defaultValue={searchParams.serviceType ?? ""}>
              <option value="">Todos los servicios</option>
              {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <button
              type="submit"
              className={cn(buttonVariants({ variant: "secondary" }))}
            >
              Filtrar
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicios</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Estado de pagos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Aún no hay clientes. Crea el primero para empezar.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link href={`/clientes/${client.id}`} className="font-medium hover:underline">
                        {client.fullName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {client.email ?? client.whatsappNumber ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {client.services.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Sin servicios</span>
                        ) : (
                          client.services.map((svc) => (
                            <Badge key={svc.id} variant="outline">
                              {serviceTypeLabel(svc.serviceType)}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.isEntrepreneur ? (
                        <Badge>Emprendedor</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.worstStatus ? (
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", DOT[client.worstStatus])} />
                          {MEMBERSHIP_STATUS_LABELS[client.worstStatus]}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/clientes/${client.id}`}
                        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                      >
                        Ver ficha
                      </Link>
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
