import { TrendingUp, TrendingDown, Sparkles, Plus, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/utils/money";
import type { Insight } from "@/types";

function InsightBadge({ insight }: { insight: Insight }) {
  const { type, deltaMonth } = insight;

  if (type === "new") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        <Plus className="h-3 w-3" />
        Novo
      </span>
    );
  }

  if (type === "gone") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Ban className="h-3 w-3" />
        Zerou
      </span>
    );
  }

  const isUp = deltaMonth > 0;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isUp
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
      }`}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}{deltaMonth}%
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

function InsightCard({ insight }: { insight: Insight }) {
  const showPrevious = insight.type !== "new";
  const showAverage = insight.averageAmount > 0;

  const tooltipText = showAverage
    ? `Média 3 meses: ${formatCurrency(insight.averageAmount)}`
    : "Sem histórico suficiente para média";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${insight.categoryColor}20`, color: insight.categoryColor }}
          >
            <InsightIcon type={insight.type} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{insight.categoryName}</p>
            <p className="text-xs text-muted-foreground font-mono tabular-nums">
              {showPrevious ? (
                <>{formatCurrency(insight.previousAmount)} → {formatCurrency(insight.currentAmount)}</>
              ) : (
                formatCurrency(insight.currentAmount)
              )}
            </p>
          </div>
          <InsightBadge insight={insight} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function DashboardInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  const expenses = insights.filter((i) => i.transactionType === "EXPENSE");
  const income = insights.filter((i) => i.transactionType === "INCOME");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {expenses.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Despesas</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {expenses.map((insight) => (
                <InsightCard key={`${insight.categoryId}-${insight.transactionType}`} insight={insight} />
              ))}
            </div>
          </div>
        )}
        {income.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Receitas</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {income.map((insight) => (
                <InsightCard key={`${insight.categoryId}-${insight.transactionType}`} insight={insight} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
