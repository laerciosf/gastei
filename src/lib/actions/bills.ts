"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { getCurrentMonth, safeMonth } from "@/lib/utils/date";

export async function getBills(month?: string) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return { currentMonth: [], carryOver: [], totalPending: 0, totalPaid: 0, availableExpenses: [] };

  const validMonth = safeMonth(month);
  const [year, m] = validMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, m - 1, 1));
  const endDate = new Date(Date.UTC(year, m, 1));

  const currentMonthStr = getCurrentMonth();
  const isCurrentOrFuture = validMonth >= currentMonthStr;

  const include = {
    category: { select: { id: true, name: true, color: true, icon: true } },
    user: { select: { name: true } },
    splitEntries: {
      select: { id: true, personName: true, amount: true, paid: true, paidAt: true },
      orderBy: { personName: "asc" as const },
    },
  };

  const currentMonthTx = await prisma.transaction.findMany({
    where: { householdId, date: { gte: startDate, lt: endDate }, splitEntries: { some: {} } },
    include,
    orderBy: { date: "desc" },
  });

  let carryOverTx: typeof currentMonthTx = [];
  let carryOverPaidAmount = 0;

  if (isCurrentOrFuture) {
    carryOverTx = await prisma.transaction.findMany({
      where: { householdId, date: { lt: startDate }, splitEntries: { some: { paid: false } } },
      include: {
        ...include,
        splitEntries: {
          select: { id: true, personName: true, amount: true, paid: true, paidAt: true },
          where: { paid: false },
          orderBy: { personName: "asc" },
        },
      },
      orderBy: { date: "desc" },
    });

    const paidFromPrevious = await prisma.splitEntry.aggregate({
      where: {
        paid: true,
        paidAt: { gte: startDate, lt: endDate },
        transaction: { householdId, date: { lt: startDate } },
      },
      _sum: { amount: true },
    });
    carryOverPaidAmount = paidFromPrevious._sum.amount ?? 0;
  }

  let totalPending = 0;
  let totalPaid = carryOverPaidAmount;

  for (const tx of currentMonthTx) {
    for (const entry of tx.splitEntries) {
      if (entry.paid) totalPaid += entry.amount;
      else totalPending += entry.amount;
    }
  }

  for (const tx of carryOverTx) {
    for (const entry of tx.splitEntries) {
      totalPending += entry.amount;
    }
  }

  const availableExpenses = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: { gte: startDate, lt: endDate },
      splitEntries: { none: {} },
    },
    select: { id: true, description: true, amount: true, date: true },
    orderBy: { date: "desc" },
  });

  return { currentMonth: currentMonthTx, carryOver: carryOverTx, totalPending, totalPaid, availableExpenses };
}
