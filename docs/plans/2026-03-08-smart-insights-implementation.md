# Smart Insights Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic spending insights that compare current month vs. previous month and vs. 3-month average, displayed on the dashboard and a dedicated `/insights` page.

**Architecture:** Server action `getInsights(month)` aggregates transactions by category/month using Prisma `groupBy`, computes deltas, and filters by 20% threshold. No new DB tables — all computed on-the-fly. Dashboard shows compact insight cards; `/insights` page shows full detail with month selector.

**Tech Stack:** Next.js Server Actions, Prisma groupBy, shadcn/ui Card, Lucide icons, existing `formatCurrency`/`safeMonth` utils.

---

### Task 1: Add Insight type to types/index.ts

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add the Insight type**

Append to `src/types/index.ts`:

```ts
export interface Insight {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currentAmount: number;
  previousAmount: number;
  averageAmount: number;
  deltaMonth: number;
  deltaTrend: number;
  type: "increase" | "decrease" | "new" | "gone";
  transactionType: TransactionType;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Insight type"
```

---

### Task 2: Create getInsights server action

**Files:**
- Create: `src/lib/actions/insights.ts`
- Reference: `src/lib/actions/dashboard.ts` (follow same patterns: `requireAuth`, `safeMonth`, `prisma.transaction.groupBy`)

**Step 1: Create the server action**

Create `src/lib/actions/insights.ts`:

```ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { safeMonth } from "@/lib/utils/date";
import type { Insight } from "@/types";

const THRESHOLD = 20;

function getPreviousMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 2, 1));
  return date.toISOString().slice(0, 7);
}

function getMonthRange(month: string, count: number): string[] {
  const months: string[] = [];
  const [year, mon] = month.split("-").map(Number);
  for (let i = 1; i <= count; i++) {
    const date = new Date(Date.UTC(year, mon - 1 - i, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

function monthToDateRange(month: string): { gte: Date; lt: Date } {
  const [year, mon] = month.split("-").map(Number);
  return {
    gte: new Date(Date.UTC(year, mon - 1, 1)),
    lt: new Date(Date.UTC(year, mon, 1)),
  };
}

export async function getInsights(month?: string): Promise<Insight[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const targetMonth = safeMonth(month);
  const previousMonth = getPreviousMonth(targetMonth);
  const trendMonths = getMonthRange(targetMonth, 3);

  const householdId = session.user.householdId;

  // Build date ranges for all months we need
  const currentRange = monthToDateRange(targetMonth);
  const previousRange = monthToDateRange(previousMonth);

  const trendRanges = trendMonths.map(monthToDateRange);
  const trendStart = trendRanges.length > 0
    ? trendRanges.reduce((min, r) => (r.gte < min ? r.gte : min), trendRanges[0].gte)
    : currentRange.gte;
  const trendEnd = trendRanges.length > 0
    ? trendRanges.reduce((max, r) => (r.lt > max ? r.lt : max), trendRanges[0].lt)
    : currentRange.lt;

  // Fetch all aggregations in parallel
  const [currentTotals, previousTotals, trendTotals] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: currentRange },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: previousRange },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: { gte: trendStart, lt: trendEnd } },
      _sum: { amount: true },
    }),
  ]);

  // Build lookup maps: categoryId-type -> amount
  const toKey = (categoryId: string, type: string) => `${categoryId}-${type}`;
  const currentMap = new Map(currentTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));
  const previousMap = new Map(previousTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));
  const trendMap = new Map(trendTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));

  // Collect all unique category-type pairs
  const allKeys = new Set([...currentMap.keys(), ...previousMap.keys()]);

  // Fetch category details
  const categoryIds = [...new Set([...allKeys].map((k) => k.split("-")[0]))];
  const categories = categoryIds.length > 0
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, icon: true, color: true, type: true },
      })
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const trendMonthCount = trendMonths.length || 1;

  const insights: Insight[] = [];

  for (const key of allKeys) {
    const [categoryId, type] = key.split("-");
    const current = currentMap.get(key) ?? 0;
    const previous = previousMap.get(key) ?? 0;
    const trendTotal = trendMap.get(key) ?? 0;
    const average = Math.round(trendTotal / trendMonthCount);

    // Calculate deltas
    let deltaMonth = 0;
    let deltaTrend = 0;
    let insightType: Insight["type"];

    if (previous === 0 && current > 0) {
      insightType = "new";
      deltaMonth = 100;
    } else if (previous > 0 && current === 0) {
      insightType = "gone";
      deltaMonth = -100;
    } else if (previous > 0) {
      deltaMonth = Math.round(((current - previous) / previous) * 100);
      insightType = deltaMonth > 0 ? "increase" : "decrease";
    } else {
      continue; // both zero
    }

    if (average > 0) {
      deltaTrend = Math.round(((current - average) / average) * 100);
    }

    // Filter by threshold
    if (Math.abs(deltaMonth) < THRESHOLD && Math.abs(deltaTrend) < THRESHOLD) {
      continue;
    }

    const cat = catMap.get(categoryId);
    if (!cat) continue;

    insights.push({
      categoryId,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      categoryColor: cat.color,
      currentAmount: current,
      previousAmount: previous,
      averageAmount: average,
      deltaMonth,
      deltaTrend,
      type: insightType,
      transactionType: type as Insight["transactionType"],
    });
  }

  // Sort by absolute deltaMonth descending
  insights.sort((a, b) => Math.abs(b.deltaMonth) - Math.abs(a.deltaMonth));

  return insights;
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/insights.ts
git commit -m "feat: add getInsights server action"
```

---

### Task 3: Create DashboardInsights component

**Files:**
- Create: `src/components/dashboard/dashboard-insights.tsx`
- Reference: `src/components/dashboard/summary-cards.tsx` (follow Card pattern)

**Step 1: Create the component**

Create `src/components/dashboard/dashboard-insights.tsx`:

```tsx
import Link from "next/link";
import { TrendingUp, TrendingDown, Sparkles, Plus, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import type { Insight } from "@/types";

function DeltaBadge({ delta, transactionType }: { delta: number; transactionType: "INCOME" | "EXPENSE" }) {
  // For expenses: increase is bad (red), decrease is good (green)
  // For income: increase is good (green), decrease is bad (red)
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
```

**Step 2: Commit**

```bash
git add src/components/dashboard/dashboard-insights.tsx
git commit -m "feat: add DashboardInsights component"
```

---

### Task 4: Integrate insights into Dashboard page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

**Step 1: Add insights to the dashboard**

Update `src/app/(app)/dashboard/page.tsx`:

- Import `getInsights` from `@/lib/actions/insights`
- Import `DashboardInsights` from `@/components/dashboard/dashboard-insights`
- Add `getInsights()` to the `Promise.all`
- Render `<DashboardInsights insights={insights} />` between `<SummaryCards />` and the grid

The updated page should look like:

```tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import { getMonthlySummary, getRecentTransactions } from "@/lib/actions/dashboard";
import { getInsights } from "@/lib/actions/insights";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const [summary, recentTransactions, insights] = await Promise.all([
    getMonthlySummary(),
    getRecentTransactions(),
    getInsights(),
  ]);

  const isEmpty = summary.totalIncome === 0 && summary.totalExpense === 0 && recentTransactions.length === 0;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6">
            <Plus className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">Sem dados neste mês</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Comece registrando suas receitas e despesas para acompanhar suas finanças.
          </p>
          <Button asChild className="mt-6">
            <Link href="/transactions">
              <Plus className="mr-2 h-4 w-4" />
              Criar Transação
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <SummaryCards
            totalIncome={summary.totalIncome}
            totalExpense={summary.totalExpense}
            balance={summary.balance}
          />
          <DashboardInsights insights={insights} />
          <div className="grid gap-6 md:grid-cols-2">
            <CategoryChart data={summary.byCategory} />
            <RecentTransactions transactions={recentTransactions} />
          </div>
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: integrate insights into dashboard"
```

---

### Task 5: Create InsightsList component for full page

**Files:**
- Create: `src/components/insights-list.tsx`

**Step 1: Create the component**

Create `src/components/insights-list.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, Plus, Ban, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import type { Insight } from "@/types";

function InsightTypeLabel({ type }: { type: Insight["type"] }) {
  switch (type) {
    case "new":
      return <span className="text-xs text-blue-600 dark:text-blue-400">Nova categoria</span>;
    case "gone":
      return <span className="text-xs text-muted-foreground">Zerou gastos</span>;
    case "increase":
      return <span className="text-xs text-rose-600 dark:text-rose-400">Aumento</span>;
    case "decrease":
      return <span className="text-xs text-emerald-600 dark:text-emerald-400">Redução</span>;
  }
}

function DeltaDisplay({ label, delta, transactionType }: { label: string; delta: number; transactionType: "INCOME" | "EXPENSE" }) {
  const isPositiveChange = transactionType === "INCOME" ? delta > 0 : delta < 0;

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-semibold font-mono tabular-nums ${
          isPositiveChange ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {delta > 0 ? "+" : ""}{delta}%
      </p>
    </div>
  );
}

function InsightIcon({ type }: { type: Insight["type"] }) {
  switch (type) {
    case "new":
      return <Plus className="h-4 w-4" />;
    case "gone":
      return <Ban className="h-4 w-4" />;
    case "increase":
      return <TrendingUp className="h-4 w-4" />;
    case "decrease":
      return <TrendingDown className="h-4 w-4" />;
  }
}

interface InsightsListProps {
  insights: Insight[];
  currentMonth: string;
}

export function InsightsList({ insights, currentMonth }: InsightsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleMonthChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", value);
    router.push(`/insights?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="month"
          value={currentMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6">
            <Sparkles className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">Nenhum insight relevante</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Os insights aparecem quando há variações maiores que 20% em relação ao mês anterior ou à média dos últimos 3 meses.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {insights.map((insight) => (
            <Card key={`${insight.categoryId}-${insight.transactionType}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${insight.categoryColor}20`, color: insight.categoryColor }}
                    >
                      <InsightIcon type={insight.type} />
                    </div>
                    <div>
                      <p className="font-medium">{insight.categoryName}</p>
                      <InsightTypeLabel type={insight.type} />
                    </div>
                  </div>
                  <p className="text-lg font-semibold font-mono tabular-nums">
                    {formatCurrency(insight.currentAmount)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Mês anterior</p>
                    <p className="text-sm font-medium font-mono tabular-nums">
                      {formatCurrency(insight.previousAmount)}
                    </p>
                  </div>
                  <DeltaDisplay label="vs. anterior" delta={insight.deltaMonth} transactionType={insight.transactionType} />
                  <DeltaDisplay label="vs. média 3m" delta={insight.deltaTrend} transactionType={insight.transactionType} />
                </div>

                {insight.averageAmount > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    Média 3 meses: {formatCurrency(insight.averageAmount)}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/insights-list.tsx
git commit -m "feat: add InsightsList component"
```

---

### Task 6: Create /insights page and add to navigation

**Files:**
- Create: `src/app/(app)/insights/page.tsx`
- Modify: `src/components/sidebar.tsx` (add nav item)

**Step 1: Create the page**

Create `src/app/(app)/insights/page.tsx`:

```tsx
import { Suspense } from "react";
import { getInsights } from "@/lib/actions/insights";
import { InsightsList } from "@/components/insights-list";
import { getCurrentMonth, safeMonth } from "@/lib/utils/date";

interface InsightsPageProps {
  searchParams: Promise<{ month?: string }>;
}

export default async function InsightsPage({ searchParams }: InsightsPageProps) {
  const params = await searchParams;
  const month = safeMonth(params.month);
  const insights = await getInsights(month);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Insights</h2>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando...</div>}>
        <InsightsList insights={insights} currentMonth={month} />
      </Suspense>
    </div>
  );
}
```

**Step 2: Add nav item to sidebar**

In `src/components/sidebar.tsx`, add to the `navItems` array after the Dashboard item:

```ts
import { LayoutDashboard, ArrowLeftRight, Tag, Target, Repeat, Users, Settings, LogOut, Sparkles } from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/insights", label: "Insights", icon: Sparkles },
  // ... rest of items
];
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/insights/page.tsx src/components/sidebar.tsx
git commit -m "feat: add /insights page and navigation"
```

---

### Task 7: Manual testing and verification

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Verify dashboard insights**

- Navigate to `/dashboard`
- If there are transactions across multiple months, insight cards should appear between summary cards and the chart
- If all categories have < 20% variation, the insights section should be hidden

**Step 3: Verify /insights page**

- Navigate to `/insights` via sidebar
- Verify month selector works
- Verify insight cards show both delta comparisons
- Verify empty state when no insights exist
- Verify color coding: red for bad changes, green for good changes (inverted for income vs expense)

**Step 4: Verify edge cases**

- First month with no history: no insights should appear
- Category that appeared this month but not last: shows as "new"
- Category from last month with zero this month: shows as "gone"

**Step 5: Final commit if any adjustments needed**
