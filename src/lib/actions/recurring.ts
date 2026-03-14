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
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const occurrence = await prisma.recurringOccurrence.findFirst({
    where: {
      id: occurrenceId,
      recurringTransaction: { householdId },
    },
    include: {
      recurringTransaction: {
        select: {
          description: true,
          amount: true,
          type: true,
          dayOfMonth: true,
          startMonth: true,
          endMonth: true,
          installments: true,
          categoryId: true,
          userId: true,
        },
      },
    },
  });

  if (!occurrence) {
    return { error: "Ocorrência não encontrada" };
  }

  const markingAsPaid = !occurrence.paid;

  try {
    await prisma.$transaction(async (tx) => {
      if (markingAsPaid) {
        const template = occurrence.recurringTransaction;
        const now = new Date();
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        let description = template.description;
        if (template.installments) {
          const allMonths = monthRange(template.startMonth, template.endMonth ?? occurrence.month);
          const installmentIndex = allMonths.indexOf(occurrence.month) + 1;
          description = `${template.description} - Parcela ${installmentIndex}/${template.installments}`;
        }

        const amount = template.installments
          ? Math.round(template.amount / template.installments)
          : template.amount;

        // Clean up orphaned transaction from inconsistent state
        if (occurrence.transactionId) {
          await tx.transaction.delete({ where: { id: occurrence.transactionId } }).catch(() => {});
        }

        const transaction = await tx.transaction.create({
          data: {
            description,
            amount,
            type: template.type,
            date,
            categoryId: template.categoryId,
            userId: template.userId,
            householdId,
          },
        });

        await tx.recurringOccurrence.update({
          where: { id: occurrenceId },
          data: { paid: true, transactionId: transaction.id },
        });
      } else {
        if (occurrence.transactionId) {
          await tx.transaction.delete({ where: { id: occurrence.transactionId } }).catch(() => {});
        }
        await tx.recurringOccurrence.update({
          where: { id: occurrenceId },
          data: { paid: false, transactionId: null },
        });
      }
    });
  } catch (error) {
    console.error("Failed to toggle occurrence:", error);
    return { error: "Erro ao atualizar ocorrência. Tente novamente." };
  }

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/splits");
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
    installments: formData.get("installments") || undefined,
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
  const installments = parsed.data.installments ?? null;
  const endMonth = installments ? addMonths(startMonth, installments - 1) : null;

  try {
    await prisma.recurringTransaction.create({
      data: {
        description: parsed.data.description,
        amount: parseCurrency(parsed.data.amount),
        type: parsed.data.type,
        dayOfMonth: parsed.data.dayOfMonth,
        startMonth,
        endMonth,
        installments,
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
    installments: formData.get("installments") || undefined,
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

  const updatedInstallments = parsed.data.installments ?? null;
  const updatedEndMonth = updatedInstallments
    ? addMonths(existing.startMonth, updatedInstallments - 1)
    : null;

  try {
    await prisma.recurringTransaction.update({
      where: { id },
      data: {
        description: parsed.data.description,
        amount: parseCurrency(parsed.data.amount),
        type: parsed.data.type,
        dayOfMonth: parsed.data.dayOfMonth,
        endMonth: updatedEndMonth,
        installments: updatedInstallments,
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
      installments: true,
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

  const toCreate: { templateId: string; month: string }[] = [];
  const endOfYear = `${currentMonth.split("-")[0]}-12`;

  for (const template of templates) {
    // Installments: materialize up to endMonth. Fixed: materialize through end of year.
    const lastMonth = template.installments ? (template.endMonth ?? currentMonth) : endOfYear;
    const allMonths = monthRange(template.startMonth, lastMonth);

    for (const month of allMonths) {
      if (!existingSet.has(`${template.id}:${month}`)) {
        toCreate.push({ templateId: template.id, month });
      }
    }
  }

  if (toCreate.length === 0) return;

  await prisma.recurringOccurrence.createMany({
    data: toCreate.map(({ templateId, month }) => ({
      month,
      recurringTransactionId: templateId,
    })),
  });
}

/** Adds N months to a "YYYY-MM" string. */
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
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
