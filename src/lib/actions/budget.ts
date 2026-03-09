"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { budgetSchema } from "@/lib/validations/budget";
import { parseCurrency } from "@/lib/utils/money";
import { safeMonth } from "@/lib/utils/date";

export interface BudgetWithSpent {
  id: string;
  month: string;
  amount: number;
  spent: number;
  category: { id: string; name: string; color: string };
}

export async function getBudgets(month?: string): Promise<BudgetWithSpent[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const targetMonth = safeMonth(month);
  const [year, mon] = targetMonth.split("-").map(Number);
  const startDate = new Date(Date.UTC(year, mon - 1, 1));
  const endDate = new Date(Date.UTC(year, mon, 1));

  const budgets = await prisma.budget.findMany({
    where: { householdId: session.user.householdId, month: targetMonth },
    include: { category: true },
  });

  const spentByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      householdId: session.user.householdId,
      type: "EXPENSE",
      date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(spentByCategory.map((s) => [s.categoryId, s._sum.amount ?? 0]));

  return budgets.map((b) => ({
    id: b.id,
    month: b.month,
    amount: b.amount,
    spent: spentMap.get(b.categoryId) ?? 0,
    category: { id: b.category.id, name: b.category.name, color: b.category.color },
  }));
}

export async function upsertBudget(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = budgetSchema.safeParse({
    month: formData.get("month"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, householdId: session.user.householdId },
  });
  if (!category) {
    return { error: "Categoria não encontrada" };
  }

  try {
    await prisma.budget.upsert({
      where: {
        month_categoryId_householdId: {
          month: parsed.data.month,
          categoryId: parsed.data.categoryId,
          householdId: session.user.householdId,
        },
      },
      update: { amount: parseCurrency(parsed.data.amount) },
      create: {
        month: parsed.data.month,
        amount: parseCurrency(parsed.data.amount),
        categoryId: parsed.data.categoryId,
        householdId: session.user.householdId,
      },
    });
  } catch (error) {
    console.error("Failed to upsert budget:", error);
    return { error: "Erro ao salvar orçamento. Tente novamente." };
  }

  revalidatePath("/budget");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  try {
    await prisma.budget.delete({
      where: { id, householdId: session.user.householdId },
    });
  } catch (error) {
    console.error("Failed to delete budget:", error);
    return { error: "Erro ao excluir orçamento. Tente novamente." };
  }

  revalidatePath("/budget");
  return { success: true };
}
