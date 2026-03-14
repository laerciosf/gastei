"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { transactionSchema } from "@/lib/validations/transaction";
import { splitSchema } from "@/lib/validations/split";
import { parseCurrency } from "@/lib/utils/money";
import { TransactionType } from "@prisma/client";
import type { Transaction, Category, Prisma } from "@prisma/client";

interface GetTransactionsParams {
  month?: string;
  categoryId?: string;
  tagId?: string;
  type?: "INCOME" | "EXPENSE";
  search?: string;
  page?: number;
  pageSize?: number;
}

type TransactionWithRelations = Transaction & {
  category: Category | null;
  user: { name: string | null };
  recurringOccurrence: { id: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
};

export interface PaginatedTransactions {
  transactions: TransactionWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalIncome: number;
  totalExpense: number;
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<PaginatedTransactions> {
  const session = await requireAuth();
  const empty = { transactions: [], total: 0, page: 1, pageSize: 50, totalPages: 0, totalIncome: 0, totalExpense: 0 };
  if (!session.user.householdId) return empty;

  const page = Math.min(10000, Math.max(1, params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));

  const where: Prisma.TransactionWhereInput = {
    householdId: session.user.householdId,
  };

  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    where.date = {
      gte: new Date(Date.UTC(year, month - 1, 1)),
      lt: new Date(Date.UTC(year, month, 1)),
    };
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.type) {
    where.type = params.type;
  } else {
    where.type = { not: TransactionType.SETTLEMENT };
  }

  if (params.search) {
    where.description = { contains: params.search, mode: "insensitive" };
  }

  if (params.tagId) {
    where.tags = { some: { tagId: params.tagId } };
  }

  const [transactions, total, totals] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        category: true,
        user: { select: { name: true } },
        recurringOccurrence: { select: { id: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        split: {
          select: {
            id: true,
            shares: {
              select: { userId: true, amount: true, user: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _sum: { amount: true },
    }),
  ]);

  return {
    transactions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    totalIncome: totals.find((t) => t.type === "INCOME")?._sum.amount ?? 0,
    totalExpense: totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0,
  };
}

export async function createTransaction(formData: FormData) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  let tagIds: string[] = [];
  try {
    const rawTagIds = formData.get("tagIds");
    if (rawTagIds) tagIds = JSON.parse(rawTagIds as string);
  } catch {
    // ignore malformed tagIds — Zod will catch invalid values
  }

  let shares: { userId: string; amount: number }[] | null = null;
  try {
    const rawShares = formData.get("shares");
    if (rawShares) shares = JSON.parse(rawShares as string);
  } catch {
    // ignore malformed shares
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    tagIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, householdId },
  });
  if (!category) {
    return { error: "Categoria não encontrada" };
  }

  if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
    const validTags = await prisma.tag.count({
      where: { id: { in: parsed.data.tagIds }, householdId },
    });
    if (validTags !== parsed.data.tagIds.length) {
      return { error: "Tag não encontrada" };
    }
  }

  let validatedShares: { userId: string; amount: number }[] | null = null;
  if (shares && shares.length >= 2 && parsed.data.type === "EXPENSE") {
    const parsedShares = splitSchema.safeParse(shares);
    if (parsedShares.success) {
      const shareSum = parsedShares.data.reduce((sum, s) => sum + s.amount, 0);
      if (shareSum === parseCurrency(parsed.data.amount)) {
        validatedShares = parsedShares.data;
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          description: parsed.data.description,
          amount: parseCurrency(parsed.data.amount),
          type: parsed.data.type,
          date: new Date(parsed.data.date + "T00:00:00Z"),
          categoryId: parsed.data.categoryId,
          userId: session.user.id,
          householdId,
        },
      });

      if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
        await tx.transactionTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({
            transactionId: transaction.id,
            tagId,
          })),
        });
      }

      if (validatedShares) {
        await tx.split.create({
          data: {
            transactionId: transaction.id,
            shares: {
              createMany: {
                data: validatedShares.map((s) => ({ userId: s.userId, amount: s.amount })),
              },
            },
          },
        });
      }
    });
  } catch (error) {
    console.error("Failed to create transaction:", error);
    return { error: "Erro ao criar transação. Tente novamente." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/splits");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  let tagIds: string[] = [];
  try {
    const rawTagIds = formData.get("tagIds");
    if (rawTagIds) tagIds = JSON.parse(rawTagIds as string);
  } catch {
    // ignore malformed tagIds — Zod will catch invalid values
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
    tagIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, householdId },
    include: { split: true },
  });

  if (!existing) {
    return { error: "Transação não encontrada" };
  }

  const category = await prisma.category.findFirst({
    where: { id: parsed.data.categoryId, householdId },
  });
  if (!category) {
    return { error: "Categoria não encontrada" };
  }

  if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
    const validTags = await prisma.tag.count({
      where: { id: { in: parsed.data.tagIds }, householdId },
    });
    if (validTags !== parsed.data.tagIds.length) {
      return { error: "Tag não encontrada" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id },
        data: {
          description: parsed.data.description,
          amount: parseCurrency(parsed.data.amount),
          type: parsed.data.type,
          date: new Date(parsed.data.date + "T00:00:00Z"),
          categoryId: parsed.data.categoryId,
        },
      });

      // Delete split if amount changed (user must re-split)
      if (existing.split && parseCurrency(parsed.data.amount) !== existing.amount) {
        await tx.split.delete({ where: { id: existing.split.id } });
      }

      await tx.transactionTag.deleteMany({ where: { transactionId: id } });

      if (parsed.data.tagIds && parsed.data.tagIds.length > 0) {
        await tx.transactionTag.createMany({
          data: parsed.data.tagIds.map((tagId) => ({
            transactionId: id,
            tagId,
          })),
        });
      }
    });
  } catch (error) {
    console.error("Failed to update transaction:", error);
    return { error: "Erro ao atualizar transação. Tente novamente." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/splits");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const existing = await prisma.transaction.findFirst({
    where: { id, householdId: session.user.householdId },
    include: { recurringOccurrence: { select: { id: true } } },
  });

  if (!existing) {
    return { error: "Transação não encontrada" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (existing.recurringOccurrence) {
        await tx.recurringOccurrence.update({
          where: { id: existing.recurringOccurrence.id },
          data: { paid: false, transactionId: null },
        });
      }
      await tx.transaction.delete({ where: { id } });
    });
  } catch (error) {
    console.error("Failed to delete transaction:", error);
    return { error: "Erro ao excluir transação. Tente novamente." };
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/recurring");
  revalidatePath("/splits");
  return { success: true };
}
