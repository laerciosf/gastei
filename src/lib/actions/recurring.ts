"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { recurringSchema } from "@/lib/validations/recurring";
import { parseCurrency } from "@/lib/utils/money";
import { getCurrentMonth } from "@/lib/utils/date";

export async function getRecurringTransactions() {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.recurringTransaction.findMany({
    where: { householdId: session.user.householdId, active: true },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecurringOccurrences() {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.recurringOccurrence.findMany({
    where: {
      recurringTransaction: {
        householdId: session.user.householdId,
        active: true,
      },
    },
    select: {
      id: true,
      month: true,
      paid: true,
      transaction: {
        select: {
          id: true,
          description: true,
          amount: true,
          type: true,
          date: true,
        },
      },
      recurringTransaction: {
        select: {
          id: true,
          description: true,
          category: { select: { id: true, name: true, color: true, type: true } },
        },
      },
    },
    orderBy: { month: "asc" },
  });
}

export async function toggleOccurrencePaid(occurrenceId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const occurrence = await prisma.recurringOccurrence.findFirst({
    where: {
      id: occurrenceId,
      recurringTransaction: { householdId: session.user.householdId },
    },
  });

  if (!occurrence) {
    return { error: "Ocorrência não encontrada" };
  }

  await prisma.recurringOccurrence.update({
    where: { id: occurrenceId },
    data: { paid: !occurrence.paid },
  });

  revalidatePath("/recurring");
  return { success: true };
}

export async function createRecurringTransaction(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = recurringSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    dayOfMonth: formData.get("dayOfMonth"),
    endMonth: formData.get("endMonth") || undefined,
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

  const startMonth = getCurrentMonth();
  const endMonth = parsed.data.endMonth || null;

  try {
    const recurring = await prisma.recurringTransaction.create({
      data: {
        description: parsed.data.description,
        amount: parseCurrency(parsed.data.amount),
        type: parsed.data.type,
        dayOfMonth: parsed.data.dayOfMonth,
        startMonth,
        endMonth,
        categoryId: parsed.data.categoryId,
        userId: session.user.id,
        householdId: session.user.householdId,
      },
    });

    // Materialize all pending months (startMonth through current month)
    await materializeRecurring();
  } catch (error) {
    console.error("Failed to create recurring transaction:", error);
    return { error: "Erro ao criar recorrência. Tente novamente." };
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateRecurringTransaction(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = recurringSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    dayOfMonth: formData.get("dayOfMonth"),
    endMonth: formData.get("endMonth") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const categoryUpdate = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, householdId: session.user.householdId },
  });
  if (!categoryUpdate) {
    return { error: "Categoria não encontrada" };
  }

  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, householdId: session.user.householdId, active: true },
  });

  if (!existing) {
    return { error: "Recorrência não encontrada" };
  }

  try {
    await prisma.recurringTransaction.update({
      where: { id },
      data: {
        description: parsed.data.description,
        amount: parseCurrency(parsed.data.amount),
        type: parsed.data.type,
        dayOfMonth: parsed.data.dayOfMonth,
        endMonth: parsed.data.endMonth || null,
        categoryId: parsed.data.categoryId,
      },
    });
  } catch (error) {
    console.error("Failed to update recurring transaction:", error);
    return { error: "Erro ao atualizar recorrência. Tente novamente." };
  }

  revalidatePath("/recurring");
  return { success: true };
}

export async function deleteRecurringTransaction(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const existing = await prisma.recurringTransaction.findFirst({
    where: { id, householdId: session.user.householdId, active: true },
  });

  if (!existing) {
    return { error: "Recorrência não encontrada" };
  }

  try {
    await prisma.recurringTransaction.update({
      where: { id },
      data: { active: false },
    });
  } catch (error) {
    console.error("Failed to delete recurring transaction:", error);
    return { error: "Erro ao excluir recorrência. Tente novamente." };
  }

  revalidatePath("/recurring");
  return { success: true };
}

/**
 * Materializes recurring transactions for all pending months
 * (from startMonth through current month, respecting endMonth).
 */
export async function materializeRecurring() {
  const session = await requireAuth();
  if (!session.user.householdId) return;

  const householdId = session.user.householdId;
  const currentMonth = getCurrentMonth();

  const templates = await prisma.recurringTransaction.findMany({
    where: {
      householdId,
      active: true,
      startMonth: { lte: currentMonth },
    },
    select: {
      id: true,
      description: true,
      amount: true,
      type: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
      categoryId: true,
      userId: true,
    },
  });

  if (templates.length === 0) return;

  // Fetch all existing occurrences for these templates
  const existingOccurrences = await prisma.recurringOccurrence.findMany({
    where: {
      recurringTransactionId: { in: templates.map((t) => t.id) },
    },
    select: { recurringTransactionId: true, month: true },
  });

  // Set of "templateId:month" already materialized
  const existingSet = new Set(
    existingOccurrences.map((o) => `${o.recurringTransactionId}:${o.month}`)
  );

  // Calculate all (template, month, dilutedAmount) pairs that need to be created
  const toCreate: { template: typeof templates[number]; month: string; monthlyAmount: number }[] = [];

  for (const template of templates) {
    // If endMonth is set, materialize up to endMonth; otherwise, up to current month
    const lastMonth = template.endMonth ?? currentMonth;
    const allMonths = monthRange(template.startMonth, lastMonth);
    const totalMonths = allMonths.length;

    // Dilute: total amount / number of months (only if endMonth is defined)
    const monthlyAmount = template.endMonth && totalMonths > 0
      ? Math.round(template.amount / totalMonths)
      : template.amount;

    for (const month of allMonths) {
      if (!existingSet.has(`${template.id}:${month}`)) {
        toCreate.push({ template, month, monthlyAmount });
      }
    }
  }

  if (toCreate.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const { template, month, monthlyAmount } of toCreate) {
      const day = Math.min(template.dayOfMonth, 28);
      const [yearStr, monthStr] = month.split("-");
      const date = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr) - 1, day));

      const transaction = await tx.transaction.create({
        data: {
          description: template.description,
          amount: monthlyAmount,
          type: template.type,
          date,
          categoryId: template.categoryId,
          userId: template.userId,
          householdId,
        },
      });
      await tx.recurringOccurrence.create({
        data: {
          month,
          transactionId: transaction.id,
          recurringTransactionId: template.id,
        },
      });
    }
  });
}

/** Generates all months in the range [start, end] in "YYYY-MM" format. */
function monthRange(start: string, end: string): string[] {
  const months: string[] = [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);

  let y = sy;
  let m = sm;

  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  return months;
}
