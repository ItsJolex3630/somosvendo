import Link from "next/link";
import { getCategoryBreakdown, getMonthlySeries, getSummary } from "@/lib/db/queries";
import { formatUsd } from "@/lib/money";
import { addMonths, endOfMonthIso, startOfMonthIso } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { NetProfitChart } from "@/components/charts/net-profit-chart";
import { CategoryBreakdown } from "@/components/charts/category-breakdown";
import { cn } from "@/lib/utils";

const RANGES = [
  { key: "this_month", label: "Este mes" },
  { key: "last_6", label: "6 meses" },
  { key: "last_12", label: "12 meses" },
];

function resolveRange(range: string, from?: string, to?: string): { from: string; to: string } {
  if (range === "custom" && from && to) return { from, to };
  const now = new Date();
  if (range === "last_6") {
    const start = new Date(`${addMonths(startOfMonthIso(now), -5)}T00:00:00Z`);
    return { from: startOfMonthIso(start), to: endOfMonthIso(now) };
  }
  if (range === "last_12") {
    const start = new Date(`${addMonths(startOfMonthIso(now), -11)}T00:00:00Z`);
    return { from: startOfMonthIso(start), to: endOfMonthIso(now) };
  }
  return { from: startOfMonthIso(now), to: endOfMonthIso(now) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; from?: string; to?: string };
}) {
  const range = searchParams.range ?? "this_month";
  const { from, to } = resolveRange(range, searchParams.from, searchParams.to);

  const [summary, series, incomeByCategory, expenseByCategory] = await Promise.all([
    getSummary(from, to),
    getMonthlySeries(from, to),
    getCategoryBreakdown(from, to, "income"),
    getCategoryBreakdown(from, to, "expense"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Resumen financiero del {from} al {to}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/movimientos/nuevo?kind=income" className={cn(buttonVariants({ size: "sm" }))}>
            + Registrar ingreso
          </Link>
          <Link
            href="/movimientos/nuevo?kind=expense"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            + Registrar gasto
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {RANGES.map((option) => (
          <Link
            key={option.key}
            href={`/?range=${option.key}`}
            className={cn(
              buttonVariants({ size: "sm", variant: range === option.key ? "secondary" : "ghost" }),
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-success">{formatUsd(summary.incomeCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">
              {formatUsd(summary.expenseCents)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm text-primary">Ganancia neta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatUsd(summary.netCents)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución de la ganancia neta</CardTitle>
        </CardHeader>
        <CardContent>
          <NetProfitChart data={series} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={incomeByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBreakdown data={expenseByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
