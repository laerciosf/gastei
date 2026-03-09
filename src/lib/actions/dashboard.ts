"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { safeMonth } from "@/lib/utils/date";

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: { name: string; color: string; total: number; type: "INCOME" | "EXPENSE" }[];
}

export async function getMonthlySummary(month?: string): Promise<MonthlySummary> {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { totalIncome: 0, totalExpense: 0, balance: 0, byCategory: [] };
  }

  const targetMonth = safeMonth(month);
  const [year, mon] = targetMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 1));

  const dateFilter = {
    householdId: session.user.householdId,
    date: { gte: startDate, lt: endDate },
  };

  const [totals, byCategory] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: dateFilter,
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId", "type"],
      where: dateFilter,
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = totals.find((t) => t.type === "INCOME")?._sum.amount ?? 0;
  const totalExpense = totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0;

  // Fetch referenced category data
  const categoryIds = byCategory.map((g) => g.categoryId);
  const categories = categoryIds.length > 0
    ? await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true, color: true },
      })
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: byCategory
      .map((g) => {
        const cat = catMap.get(g.categoryId);
        return {
          name: cat?.name ?? "Sem categoria",
          color: cat?.color ?? "#6b7280",
          total: g._sum.amount ?? 0,
          type: g.type,
        };
      })
      .sort((a, b) => b.total - a.total),
  };
}

export async function getRecentTransactions(limit = 5) {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const safeLimit = Math.min(Math.max(1, limit), 50);

  return prisma.transaction.findMany({
    where: { householdId: session.user.householdId },
    include: { category: true, user: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: safeLimit,
  });
}
