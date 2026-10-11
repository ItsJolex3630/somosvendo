"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd, toUsd } from "@/lib/money";
import { monthLabel } from "@/lib/format";
import type { SeriesPoint } from "@/lib/db/queries";

export function NetProfitChart({ data }: { data: SeriesPoint[] }) {
  const chartData = data.map((point) => ({
    name: monthLabel(point.month),
    Ingresos: toUsd(point.incomeCents),
    Gastos: toUsd(point.expenseCents),
    Neto: toUsd(point.netCents),
  }));

  if (!chartData.length) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Sin datos en el rango.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 24% 16%)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "hsl(140 16% 64%)", fontSize: 12 }} />
          <YAxis tick={{ fill: "hsl(140 16% 64%)", fontSize: 12 }} />
          <Tooltip
            formatter={(value: number) => formatUsd(Math.round(value * 100))}
            contentStyle={{
              background: "hsl(155 48% 7%)",
              border: "1px solid hsl(150 24% 16%)",
              borderRadius: 10,
              color: "hsl(74 100% 95%)",
            }}
          />
          <Bar dataKey="Ingresos" fill="hsl(142 52% 46%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Gastos" fill="hsl(0 72% 58%)" radius={[4, 4, 0, 0]} />
          <Line type="monotone" dataKey="Neto" stroke="hsl(76 82% 71%)" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
