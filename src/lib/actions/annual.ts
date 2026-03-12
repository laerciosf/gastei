"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface RawMonthlyGroup {
  month: number;
  categoryId: string;
  type: string;
  total: bigint;
}

export interface AnnualCategory {
  name: string;
  color: string;
  total: number;
}

export interface AnnualSummary {
  chartData: Record<string, string | number>[];
  categories: AnnualCategory[];
  currentMonthIndex: number;
}

export async function getAnnualSummary(): Promise<AnnualSummary> {
  const session = await requireAuth();
  const now = new Date();
  const currentMonthIndex = now.getUTCMonth();
  const empty: AnnualSummary = { chartData: [], categories: [], currentMonthIndex };

  if (!session.user.householdId) return empty;

  const householdId = session.user.householdId;
  const year = now.getUTCFullYear();
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year + 1, 0, 1));

  const groups = await prisma.$queryRaw<RawMonthlyGroup[]>`
    SELECT
      EXTRACT(MONTH FROM date)::int AS month,
      "categoryId",
      type::text,
      SUM(amount) AS total
    FROM transactions
    WHERE "householdId" = ${householdId}
      AND date >= ${startDate}
      AND date < ${endDate}
      AND type = 'EXPENSE'
    GROUP BY month, "categoryId", type
    ORDER BY month
  `;

  if (groups.length === 0) return empty;

  const categoryIds = [...new Set(groups.map((g) => g.categoryId))];
  const categoriesDb = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });
  const catMap = new Map(categoriesDb.map((c) => [c.id, c]));

  const categoryTotalsMap = new Map<string, AnnualCategory>();

  const chartData: Record<string, string | number>[] = MONTH_LABELS.map((label) => ({ label }));

  for (const group of groups) {
    const idx = group.month - 1;
    const cat = catMap.get(group.categoryId);
    if (!cat) continue;

    const amount = Number(group.total);
    chartData[idx][cat.name] = ((chartData[idx][cat.name] as number) || 0) + amount;

    const existing = categoryTotalsMap.get(cat.id);
    if (existing) {
      existing.total += amount;
    } else {
      categoryTotalsMap.set(cat.id, { name: cat.name, color: cat.color, total: amount });
    }
  }

  const categories = [...categoryTotalsMap.values()].sort((a, b) => b.total - a.total);

  return { chartData, categories, currentMonthIndex };
}
