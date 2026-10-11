import Link from "next/link";
import { deleteMovement } from "@/app/actions/movements";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
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
  CATEGORY_LABELS,
  INCOME_CATEGORIES,
  SELECTABLE_EXPENSE_CATEGORIES,
  categoryLabel,
} from "@/lib/constants";
import { listMovements } from "@/lib/db/queries";
import { formatDate } from "@/lib/format";
import { formatUsdSigned } from "@/lib/money";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...SELECTABLE_EXPENSE_CATEGORIES];

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: { kind?: string; category?: string; from?: string; to?: string; q?: string };
}) {
  const rows = await listMovements({
    kind: searchParams.kind === "income" || searchParams.kind === "expense" ? searchParams.kind : undefined,
    category: searchParams.category || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
    q: searchParams.q || undefined,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Movimientos</h1>
        <Link href="/movimientos/nuevo" className={cn(buttonVariants({ size: "sm" }))}>
          + Nuevo movimiento
        </Link>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <Select name="kind" defaultValue={searchParams.kind ?? ""}>
              <option value="">Tipo: todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </Select>
            <Select name="category" defaultValue={searchParams.category ?? ""}>
              <option value="">Categoría: todas</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <Input type="date" name="from" defaultValue={searchParams.from ?? ""} />
            <Input type="date" name="to" defaultValue={searchParams.to ?? ""} />
            <div className="flex gap-2">
              <Input name="q" placeholder="Buscar…" defaultValue={searchParams.q ?? ""} />
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Sin movimientos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(m.movementDate)}</TableCell>
                    <TableCell>
                      <Badge variant={m.kind === "income" ? "success" : "destructive"}>
                        {m.kind === "income" ? "Ingreso" : "Gasto"}
                      </Badge>
                    </TableCell>
                    <TableCell>{categoryLabel(m.category)}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {m.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.clientName ?? "—"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        m.kind === "income" ? "text-success" : "text-destructive",
                      )}
                    >
                      {formatUsdSigned(m.amountCents, m.kind)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/movimientos/${m.id}/editar`}
                          className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                        >
                          Editar
                        </Link>
                        <form action={deleteMovement}>
                          <input type="hidden" name="id" value={m.id} />
                          <ConfirmButton
                            variant="ghost"
                            size="sm"
                            message="¿Eliminar este movimiento? Esta acción no se puede deshacer."
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
    </div>
  );
}
