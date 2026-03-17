"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { splitEntriesSchema } from "@/lib/validations/split";

function revalidateSplitPaths() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/bills");
}

export async function createSplitEntries(
  transactionId: string,
  entries: { personName: string; amount: number }[]
) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return { error: "Grupo não encontrado" };

  const parsed = splitEntriesSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId },
    include: { splitEntries: { select: { id: true } } },
  });

  if (!transaction) return { error: "Transação não encontrada" };
  if (transaction.type !== "EXPENSE") return { error: "Apenas despesas podem ser divididas" };
  if (transaction.splitEntries.length > 0) return { error: "Esta transação já possui divisão" };

  const entrySum = parsed.data.reduce((acc, e) => acc + e.amount, 0);
  if (entrySum > transaction.amount) {
    return { error: "A soma das partes não pode exceder o valor da transação" };
  }

  try {
    await prisma.splitEntry.createMany({
      data: parsed.data.map((e) => ({
        transactionId,
        personName: e.personName,
        amount: e.amount,
      })),
    });
  } catch (error) {
    console.error("Failed to create split entries:", error);
    return { error: "Erro ao criar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function updateSplitEntries(
  transactionId: string,
  entries: { personName: string; amount: number }[]
) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return { error: "Grupo não encontrado" };

  const parsed = splitEntriesSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId },
  });

  if (!transaction) return { error: "Transação não encontrada" };

  const entrySum = parsed.data.reduce((acc, e) => acc + e.amount, 0);
  if (entrySum > transaction.amount) {
    return { error: "A soma das partes não pode exceder o valor da transação" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.splitEntry.deleteMany({ where: { transactionId } });
      await tx.splitEntry.createMany({
        data: parsed.data.map((e) => ({
          transactionId,
          personName: e.personName,
          amount: e.amount,
        })),
      });
    });
  } catch (error) {
    console.error("Failed to update split entries:", error);
    return { error: "Erro ao atualizar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function deleteSplitEntries(transactionId: string) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return { error: "Grupo não encontrado" };

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId },
  });

  if (!transaction) return { error: "Transação não encontrada" };

  try {
    await prisma.splitEntry.deleteMany({ where: { transactionId } });
  } catch (error) {
    console.error("Failed to delete split entries:", error);
    return { error: "Erro ao excluir divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function toggleSplitPaid(entryId: string) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return { error: "Grupo não encontrado" };

  const entry = await prisma.splitEntry.findFirst({
    where: { id: entryId, transaction: { householdId } },
  });

  if (!entry) return { error: "Entrada não encontrada" };

  try {
    await prisma.splitEntry.update({
      where: { id: entryId },
      data: {
        paid: !entry.paid,
        paidAt: !entry.paid ? new Date() : null,
      },
    });
  } catch (error) {
    console.error("Failed to toggle split paid:", error);
    return { error: "Erro ao atualizar status. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
