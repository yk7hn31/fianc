"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatAmount } from "@/lib/money";

// Monochrome ramp: DESIGN.md forbids chromatic decoration.
const SHADES = ["#0a0a0a", "#3f3f3f", "#5c5c5c", "#737373", "#9a9a9a", "#c4c4c4"];

export function SpendDonutChart({
  data,
  currency,
}: {
  data: { name: string; spentMinor: number }[];
  currency: string;
}) {
  if (data.length === 0) {
    return <p className="text-muted-foreground">No spending this month.</p>;
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="spentMinor"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SHADES[i % SHADES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatAmount(Number(v), currency)}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid #e5e5e5",
              fontSize: 14,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
