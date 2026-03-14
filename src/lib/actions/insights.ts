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

  const currentRange = monthToDateRange(targetMonth);
  const previousRange = monthToDateRange(previousMonth);

  const trendRanges = trendMonths.map(monthToDateRange);
  const trendStart = trendRanges.length > 0
    ? trendRanges.reduce((min, r) => (r.gte < min ? r.gte : min), trendRanges[0].gte)
    : currentRange.gte;
  const trendEnd = trendRanges.length > 0
    ? trendRanges.reduce((max, r) => (r.lt > max ? r.lt : max), trendRanges[0].lt)
    : currentRange.lt;

  const [currentTotals, previousTotals, trendTotals] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: currentRange, type: { not: "SETTLEMENT" as const } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: previousRange, type: { not: "SETTLEMENT" as const } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: { householdId, date: { gte: trendStart, lt: trendEnd }, type: { not: "SETTLEMENT" as const } },
      _sum: { amount: true },
    }),
  ]);

  const toKey = (categoryId: string, type: string) => `${categoryId}-${type}`;
  const currentMap = new Map(currentTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));
  const previousMap = new Map(previousTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));
  const trendMap = new Map(trendTotals.map((t) => [toKey(t.categoryId, t.type), t._sum.amount ?? 0]));

  const allKeys = new Set([...currentMap.keys(), ...previousMap.keys()]);

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
      insightType = deltaMonth >= 0 ? "increase" : "decrease";
    } else {
      continue;
    }

    if (average > 0) {
      deltaTrend = Math.round(((current - average) / average) * 100);
    }

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

  insights.sort((a, b) => Math.abs(b.deltaMonth) - Math.abs(a.deltaMonth));

  return insights;
}
