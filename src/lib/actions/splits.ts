"use server";

import { revalidatePath } from "next/cache";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { splitSchema, settlementSchema } from "@/lib/validations/split";
import { parseCurrency } from "@/lib/utils/money";
import { safeMonth } from "@/lib/utils/date";
import type { SplitBalance, SplitTransaction, Settlement } from "@/types";

function revalidateSplitPaths() {
  revalidatePath("/splits");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function getBalance(): Promise<SplitBalance[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const members = await prisma.user.findMany({
    where: { householdId },
    select: { id: true, name: true },
  });

  if (members.length < 2) return [];

  const currentUserId = session.user.id;

  const [shares, settlements] = await Promise.all([
    prisma.splitShare.findMany({
      where: {
        split: { transaction: { householdId } },
      },
      include: {
        split: {
          include: {
            transaction: { select: { userId: true } },
          },
        },
      },
    }),
    prisma.transaction.findMany({
      where: {
        householdId,
        type: TransactionType.SETTLEMENT,
        settlementFromId: { not: null },
        settlementToId: { not: null },
      },
      select: {
        amount: true,
        settlementFromId: true,
        settlementToId: true,
      },
    }),
  ]);

  // Track net balance between current user and each other member
  // positive = current user owes them, negative = they owe current user
  const balanceMap = new Map<string, number>();
  for (const member of members) {
    if (member.id !== currentUserId) {
      balanceMap.set(member.id, 0);
    }
  }

  for (const share of shares) {
    const payerId = share.split.transaction.userId;
    const debtorId = share.userId;

    // Skip shares where payer == debtor (paying your own part)
    if (payerId === debtorId) continue;

    if (payerId === currentUserId && debtorId !== currentUserId) {
      // I paid, someone else owes me -> they owe me (negative)
      balanceMap.set(debtorId, (balanceMap.get(debtorId) ?? 0) - share.amount);
    } else if (debtorId === currentUserId && payerId !== currentUserId) {
      // Someone else paid, I owe them -> I owe them (positive)
      balanceMap.set(payerId, (balanceMap.get(payerId) ?? 0) + share.amount);
    }
  }

  // Apply settlements
  for (const s of settlements) {
    const fromId = s.settlementFromId!;
    const toId = s.settlementToId!;

    if (fromId === currentUserId && toId !== currentUserId) {
      // I settled with them (I paid them) -> reduces what I owe (subtract)
      balanceMap.set(toId, (balanceMap.get(toId) ?? 0) - s.amount);
    } else if (toId === currentUserId && fromId !== currentUserId) {
      // They settled with me (they paid me) -> reduces what they owe (add, making it less negative)
      balanceMap.set(fromId, (balanceMap.get(fromId) ?? 0) + s.amount);
    }
  }

  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  return Array.from(balanceMap.entries())
    .filter(([, amount]) => amount !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([memberId, amount]) => ({
      memberId,
      memberName: memberMap.get(memberId) ?? null,
      amount,
    }));
}

export async function getSplits(month?: string): Promise<SplitTransaction[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const safe = safeMonth(month);
  const [year, mon] = safe.split("-").map(Number);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: TransactionType.EXPENSE,
      split: { isNot: null },
      date: {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      },
    },
    include: {
      category: { select: { name: true, color: true } },
      user: { select: { id: true, name: true } },
      split: {
        include: {
          shares: {
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
    payer: { id: t.user.id, name: t.user.name },
    category: { name: t.category?.name ?? "", color: t.category?.color ?? "#6b7280" },
    shares: (t.split?.shares ?? []).map((s) => ({
      userId: s.userId,
      userName: s.user.name,
      amount: s.amount,
    })),
  }));
}

export async function getSettlements(month?: string): Promise<Settlement[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const safe = safeMonth(month);
  const [year, mon] = safe.split("-").map(Number);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: TransactionType.SETTLEMENT,
      settlementFromId: { not: null },
      settlementToId: { not: null },
      date: {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      },
    },
    include: {
      settlementFrom: { select: { id: true, name: true } },
      settlementTo: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    description: t.description,
    amount: t.amount,
    date: t.date,
    from: { id: t.settlementFrom!.id, name: t.settlementFrom!.name },
    to: { id: t.settlementTo!.id, name: t.settlementTo!.name },
  }));
}

export async function createSplit(transactionId: string, shares: { userId: string; amount: number }[]) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = splitSchema.safeParse(shares);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId },
    include: { split: { select: { id: true } } },
  });

  if (!transaction) {
    return { error: "Transação não encontrada" };
  }

  if (transaction.type !== "EXPENSE") {
    return { error: "Apenas despesas podem ser divididas" };
  }

  if (transaction.split) {
    return { error: "Esta transação já possui uma divisão" };
  }

  const shareSum = parsed.data.reduce((acc, s) => acc + s.amount, 0);
  if (shareSum !== transaction.amount) {
    return { error: "A soma das partes deve ser igual ao valor da transação" };
  }

  const shareUserIds = parsed.data.map((s) => s.userId);
  const validMembers = await prisma.user.count({
    where: { id: { in: shareUserIds }, householdId },
  });
  if (validMembers !== shareUserIds.length) {
    return { error: "Todos os participantes devem ser membros do grupo" };
  }

  if (!shareUserIds.includes(transaction.userId)) {
    return { error: "O pagador deve estar incluído na divisão" };
  }

  try {
    await prisma.split.create({
      data: {
        transactionId,
        shares: {
          create: parsed.data.map((s) => ({
            userId: s.userId,
            amount: s.amount,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Failed to create split:", error);
    return { error: "Erro ao criar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function updateSplit(splitId: string, shares: { userId: string; amount: number }[]) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = splitSchema.safeParse(shares);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const split = await prisma.split.findFirst({
    where: { id: splitId, transaction: { householdId } },
    include: { transaction: { select: { amount: true, userId: true } } },
  });

  if (!split) {
    return { error: "Divisão não encontrada" };
  }

  const shareSum = parsed.data.reduce((acc, s) => acc + s.amount, 0);
  if (shareSum !== split.transaction.amount) {
    return { error: "A soma das partes deve ser igual ao valor da transação" };
  }

  const shareUserIds = parsed.data.map((s) => s.userId);
  const validMembers = await prisma.user.count({
    where: { id: { in: shareUserIds }, householdId },
  });
  if (validMembers !== shareUserIds.length) {
    return { error: "Todos os participantes devem ser membros do grupo" };
  }

  if (!shareUserIds.includes(split.transaction.userId)) {
    return { error: "O pagador deve estar incluído na divisão" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.splitShare.deleteMany({ where: { splitId } });
      await tx.splitShare.createMany({
        data: parsed.data.map((s) => ({
          splitId,
          userId: s.userId,
          amount: s.amount,
        })),
      });
    });
  } catch (error) {
    console.error("Failed to update split:", error);
    return { error: "Erro ao atualizar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function deleteSplit(splitId: string) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const split = await prisma.split.findFirst({
    where: { id: splitId, transaction: { householdId } },
  });

  if (!split) {
    return { error: "Divisão não encontrada" };
  }

  try {
    await prisma.split.delete({ where: { id: splitId } });
  } catch (error) {
    console.error("Failed to delete split:", error);
    return { error: "Erro ao excluir divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}

export async function createSettlement(formData: FormData) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = settlementSchema.safeParse({
    toUserId: formData.get("toUserId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  if (parsed.data.toUserId === session.user.id) {
    return { error: "Você não pode acertar consigo mesmo" };
  }

  const targetUser = await prisma.user.findFirst({
    where: { id: parsed.data.toUserId, householdId },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    return { error: "Membro não encontrado no grupo" };
  }

  // Validate amount against current balance
  const balances = await getBalance();
  const balance = balances.find((b) => b.memberId === parsed.data.toUserId);
  const amountCents = parseCurrency(parsed.data.amount);

  if (!balance || balance.amount <= 0) {
    return { error: "Você não deve nada a este membro" };
  }

  if (amountCents > balance.amount) {
    return { error: "O valor excede o saldo devedor" };
  }

  try {
    await prisma.transaction.create({
      data: {
        description: `Acerto com ${targetUser.name ?? "membro"}`,
        amount: amountCents,
        type: TransactionType.SETTLEMENT,
        date: new Date(),
        categoryId: null,
        userId: session.user.id,
        householdId,
        settlementFromId: session.user.id,
        settlementToId: parsed.data.toUserId,
      },
    });
  } catch (error) {
    console.error("Failed to create settlement:", error);
    return { error: "Erro ao criar acerto. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
