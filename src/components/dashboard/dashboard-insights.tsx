import Link from "next/link";
import { TrendingUp, TrendingDown, Sparkles, Plus, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import type { Insight } from "@/types";

function DeltaBadge({ delta, transactionType }: { delta: number; transactionType: "INCOME" | "EXPENSE" }) {
  const isPositiveChange = transactionType === "INCOME" ? delta > 0 : delta < 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPositiveChange ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      }`}
    >
      {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta > 0 ? "+" : ""}{delta}%
    </span>
  );
}

function InsightIcon({ type }: { type: Insight["type"] }) {
  switch (type) {
    case "new":
      return <Plus className="h-3.5 w-3.5" />;
    case "gone":
      return <Ban className="h-3.5 w-3.5" />;
    case "increase":
      return <TrendingUp className="h-3.5 w-3.5" />;
    case "decrease":
      return <TrendingDown className="h-3.5 w-3.5" />;
  }
}

export function DashboardInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Insights
        </CardTitle>
        <Link href="/insights" className="text-sm text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((insight) => (
            <div
              key={`${insight.categoryId}-${insight.transactionType}`}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${insight.categoryColor}20`, color: insight.categoryColor }}
              >
                <InsightIcon type={insight.type} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{insight.categoryName}</p>
                <p className="text-xs text-muted-foreground font-mono tabular-nums">
                  {formatCurrency(insight.currentAmount)}
                </p>
              </div>
              <DeltaBadge delta={insight.deltaMonth} transactionType={insight.transactionType} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
