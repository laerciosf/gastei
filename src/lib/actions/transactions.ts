"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { transactionSchema } from "@/lib/validations/transaction";
import { parseCurrency } from "@/lib/utils/money";

interface GetTransactionsParams {
  month?: string;
  categoryId?: string;
  type?: "INCOME" | "EXPENSE";
  search?: string;
}

export async function getTransactions(params: GetTransactionsParams = {}) {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const where: Record<string, unknown> = {
    householdId: session.user.householdId,
  };

  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    where.date = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.type) {
    where.type = params.type;
  }

  if (params.search) {
    where.description = { contains: params.search, mode: "insensitive" };
  }

  return prisma.transaction.findMany({
    where,
    include: { category: true, user: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
}

export async function createTransaction(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.transaction.create({
    data: {
      description: parsed.data.description,
      amount: parseCurrency(parsed.data.amount),
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      categoryId: parsed.data.categoryId,
      userId: session.user.id,
      householdId: session.user.householdId,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.transaction.update({
    where: { id, householdId: session.user.householdId },
    data: {
      description: parsed.data.description,
      amount: parseCurrency(parsed.data.amount),
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      categoryId: parsed.data.categoryId,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  await prisma.transaction.delete({
    where: { id, householdId: session.user.householdId },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
