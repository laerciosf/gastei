"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: { name: string; color: string; total: number; type: string }[];
}

export async function getMonthlySummary(month?: string): Promise<MonthlySummary> {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { totalIncome: 0, totalExpense: 0, balance: 0, byCategory: [] };
  }

  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: session.user.householdId,
      date: { gte: startDate, lt: endDate },
    },
    include: { category: true },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, { name: string; color: string; total: number; type: string }>();

  for (const tx of transactions) {
    if (tx.type === "INCOME") {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }

    const existing = categoryMap.get(tx.categoryId);
    if (existing) {
      existing.total += tx.amount;
    } else {
      categoryMap.set(tx.categoryId, {
        name: tx.category.name,
        color: tx.category.color,
        total: tx.amount,
        type: tx.type,
      });
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
  };
}

export async function getRecentTransactions(limit = 5) {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.transaction.findMany({
    where: { householdId: session.user.householdId },
    include: { category: true, user: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: limit,
  });
}
