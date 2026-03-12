"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";

import type { AnnualCategory } from "@/lib/actions/annual";

interface AnnualChartProps {
  chartData: Record<string, string | number>[];
  categories: AnnualCategory[];
  currentMonthIndex: number;
}

export function AnnualChart({ chartData, categories, currentMonthIndex }: AnnualChartProps) {
  if (categories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparativo Anual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Sem despesas neste ano</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Comparativo Anual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={(props) => {
                const { x, y, payload } = props as { x: number; y: number; payload: { index: number; value: string } };
                const isCurrent = payload.index === currentMonthIndex;
                return (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={isCurrent ? 700 : 400}
                    fill={isCurrent ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={90} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(label) => `${label}`}
            />
            <Legend />
            {categories.map((cat) => (
              <Bar key={cat.name} dataKey={cat.name} stackId="expense" fill={cat.color} radius={[0, 0, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell
                    key={idx}
                    opacity={idx === currentMonthIndex ? 1 : 0.7}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
