"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { goalSchema, goalEntrySchema } from "@/lib/validations/goal";
import { parseCurrency } from "@/lib/utils/money";
import type { GoalType } from "@prisma/client";

export interface GoalWithProgress {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  icon: string;
  color: string;
  percentage: number;
  createdAt: Date;
  userId: string;
  user: { name: string | null };
}

export interface GoalDetail extends GoalWithProgress {
  entries: {
    id: string;
    amount: number;
    note: string | null;
    createdAt: Date;
  }[];
}

export async function getGoals(type?: GoalType): Promise<GoalWithProgress[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const where = {
    householdId: session.user.householdId,
    ...(type && { type }),
  };

  const goals = await prisma.savingsGoal.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
  }));
}

export async function getGoalWithEntries(id: string): Promise<GoalDetail | null> {
  const session = await requireAuth();
  if (!session.user.householdId) return null;

  const goal = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
    include: {
      user: { select: { name: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!goal) return null;

  return {
    id: goal.id,
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    icon: goal.icon,
    color: goal.color,
    percentage: goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0,
    createdAt: goal.createdAt,
    userId: goal.userId,
    user: goal.user,
    entries: goal.entries,
  };
}

export async function getGoalsWithEntries(type?: GoalType): Promise<GoalDetail[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const goals = await prisma.savingsGoal.findMany({
    where: {
      householdId: session.user.householdId,
      ...(type && { type }),
    },
    include: {
      user: { select: { name: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
    entries: g.entries,
  }));
}

export async function createGoal(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await prisma.savingsGoal.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type as GoalType,
        targetAmount: parseCurrency(parsed.data.targetAmount),
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        icon: parsed.data.icon ?? "piggy-bank",
        color: parsed.data.color ?? "#10b981",
        householdId: session.user.householdId,
        userId: session.user.id,
      },
    });
  } catch (error) {
    console.error("Failed to create goal:", error);
    return { error: "Erro ao criar meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function updateGoal(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const existing = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
  });
  if (!existing) return { error: "Meta não encontrada" };
  if (existing.userId !== session.user.id) return { error: "Apenas o criador pode editar esta meta" };

  try {
    await prisma.savingsGoal.update({
      where: { id },
      data: {
        name: parsed.data.name,
        type: parsed.data.type as GoalType,
        targetAmount: parseCurrency(parsed.data.targetAmount),
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        icon: parsed.data.icon ?? "piggy-bank",
        color: parsed.data.color ?? "#10b981",
      },
    });
  } catch (error) {
    console.error("Failed to update goal:", error);
    return { error: "Erro ao atualizar meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const existing = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
  });
  if (!existing) return { error: "Meta não encontrada" };
  if (existing.userId !== session.user.id) return { error: "Apenas o criador pode excluir esta meta" };

  try {
    await prisma.savingsGoal.delete({ where: { id } });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return { error: "Erro ao excluir meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function addGoalEntry(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalEntrySchema.safeParse({
    amount: formData.get("amount"),
    type: formData.get("type"),
    goalId: formData.get("goalId"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const amountCents = parseCurrency(parsed.data.amount);
  const signedAmount = parsed.data.type === "withdrawal" ? -amountCents : amountCents;

  try {
    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({
        where: { id: parsed.data.goalId, householdId: session.user.householdId! },
      });

      if (!goal) throw new Error("Goal not found");

      if (signedAmount < 0 && goal.currentAmount + signedAmount < 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.goalEntry.create({
        data: {
          amount: signedAmount,
          note: parsed.data.note ?? null,
          goalId: goal.id,
        },
      });

      await tx.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: goal.currentAmount + signedAmount },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { error: "Saldo insuficiente para esta retirada" };
    }
    console.error("Failed to add goal entry:", error);
    return { error: "Erro ao registrar. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function deleteGoalEntry(entryId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.goalEntry.findUnique({
        where: { id: entryId },
        include: { goal: { select: { id: true, householdId: true, currentAmount: true } } },
      });

      if (!entry || entry.goal.householdId !== session.user.householdId) {
        throw new Error("Entry not found");
      }

      const newAmount = entry.goal.currentAmount - entry.amount;

      await tx.goalEntry.delete({ where: { id: entryId } });
      await tx.savingsGoal.update({
        where: { id: entry.goalId },
        data: { currentAmount: Math.max(0, newAmount) },
      });
    });
  } catch (error) {
    console.error("Failed to delete goal entry:", error);
    return { error: "Erro ao remover registro. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function getGoalsSummary(): Promise<GoalWithProgress[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const allGoals = await prisma.savingsGoal.findMany({
    where: { householdId: session.user.householdId },
    include: { user: { select: { name: true } } },
  });

  const sorted = allGoals
    .map((g) => ({
      ...g,
      percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    }))
    .filter((g) => g.percentage < 100)
    .sort((a, b) => {
      if (a.targetDate && b.targetDate) return a.targetDate.getTime() - b.targetDate.getTime();
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.percentage - a.percentage;
    })
    .slice(0, 3);

  return sorted.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
  }));
}
