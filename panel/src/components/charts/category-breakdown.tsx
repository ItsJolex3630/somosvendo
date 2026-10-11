"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { categoryLabel } from "@/lib/constants";
import { formatUsd, toUsd } from "@/lib/money";

const COLORS = [
  "hsl(76 82% 71%)",
  "hsl(142 52% 46%)",
  "hsl(190 60% 55%)",
  "hsl(42 92% 60%)",
  "hsl(0 72% 58%)",
  "hsl(280 55% 65%)",
  "hsl(160 40% 50%)",
  "hsl(20 80% 60%)",
];

export function CategoryBreakdown({
  data,
}: {
  data: { category: string; totalCents: number }[];
}) {
  if (!data.length) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Sin datos.</p>;
  }

  const chartData = data.map((item) => ({
    name: categoryLabel(item.category),
    value: toUsd(item.totalCents),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatUsd(Math.round(value * 100))}
            contentStyle={{
              background: "hsl(155 48% 7%)",
              border: "1px solid hsl(150 24% 16%)",
              borderRadius: 10,
              color: "hsl(74 100% 95%)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
