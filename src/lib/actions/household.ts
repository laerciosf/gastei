"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { DEFAULT_CATEGORIES, DEFAULT_HOUSEHOLD_NAME } from "@/lib/setup-household";
import { z } from "zod/v4";
import { defaultSplitRatioSchema } from "@/lib/validations/split";

const inviteSchema = z.object({
  email: z.email("Email inválido"),
});

export async function getHousehold() {
  const session = await requireAuth();
  if (!session.user.householdId) return null;

  return prisma.household.findUnique({
    where: { id: session.user.householdId },
    include: {
      members: { select: { id: true, name: true, email: true, image: true } },
    },
  });
}

export async function inviteMember(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const invitee = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!invitee) {
    return { error: "Não foi possível enviar o convite. Verifique o email informado." };
  }

  if (invitee.id === session.user.id) {
    return { error: "Você não pode convidar a si mesmo" };
  }

  if (invitee.householdId === session.user.householdId) {
    return { error: "Usuário já faz parte deste grupo" };
  }

  const pendingCount = await prisma.householdInvite.count({
    where: {
      householdId: session.user.householdId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });

  if (pendingCount >= 5) {
    return { error: "Limite de 5 convites pendentes atingido" };
  }

  // Clean up previous REJECTED invite to allow re-inviting
  await prisma.householdInvite.deleteMany({
    where: {
      householdId: session.user.householdId,
      inviteeId: invitee.id,
      status: "REJECTED",
    },
  });

  try {
    await prisma.householdInvite.create({
      data: {
        householdId: session.user.householdId,
        inviterId: session.user.id,
        inviteeId: invitee.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });
  } catch (error) {
    console.error("Failed to create invite:", error);
    return { error: "Já existe um convite pendente para este usuário" };
  }

  revalidatePath("/household");
  return { success: true };
}

export async function getPendingInvites() {
  const session = await requireAuth();

  return prisma.householdInvite.findMany({
    where: {
      inviteeId: session.user.id,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      household: { select: { id: true, name: true } },
      inviter: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getSentInvites() {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.householdInvite.findMany({
    where: {
      householdId: session.user.householdId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      invitee: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptInvite(inviteId: string) {
  const session = await requireAuth();

  const invite = await prisma.householdInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.inviteeId !== session.user.id) {
    return { error: "Convite não encontrado" };
  }

  if (invite.status !== "PENDING") {
    return { error: "Este convite já foi processado" };
  }

  if (invite.expiresAt < new Date()) {
    return { error: "Este convite expirou" };
  }

  const newHouseholdId = invite.householdId;
  const oldHouseholdId = session.user.householdId;

  await prisma.$transaction(async (tx) => {
    // Move user to the new household
    await tx.user.update({
      where: { id: session.user.id },
      data: { householdId: newHouseholdId },
    });
    // Mark invite as accepted
    await tx.householdInvite.update({
      where: { id: inviteId },
      data: { status: "ACCEPTED" },
    });
    // Reject other pending invites for this user
    await tx.householdInvite.updateMany({
      where: {
        inviteeId: session.user.id,
        status: "PENDING",
        id: { not: inviteId },
      },
      data: { status: "REJECTED" },
    });

    // Reset default split ratio since membership changed
    await tx.household.update({
      where: { id: newHouseholdId },
      data: { defaultSplitRatio: Prisma.DbNull },
    });

    // Check if old household is empty and delete it
    if (oldHouseholdId) {
      const remainingMembers = await tx.user.count({
        where: { householdId: oldHouseholdId },
      });
      if (remainingMembers === 0) {
        await tx.household.delete({ where: { id: oldHouseholdId } });
      }
    }
  });

  revalidatePath("/household");
  return { success: true, newHouseholdId };
}

export async function rejectInvite(inviteId: string) {
  const session = await requireAuth();

  const invite = await prisma.householdInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.inviteeId !== session.user.id) {
    return { error: "Convite não encontrado" };
  }

  if (invite.status !== "PENDING") {
    return { error: "Este convite já foi processado" };
  }

  await prisma.householdInvite.update({
    where: { id: inviteId },
    data: { status: "REJECTED" },
  });

  revalidatePath("/household");
  return { success: true };
}

export async function cancelInvite(inviteId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  const invite = await prisma.householdInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite || invite.householdId !== session.user.householdId) {
    return { error: "Convite não encontrado" };
  }

  if (invite.status !== "PENDING") {
    return { error: "Este convite já foi processado" };
  }

  await prisma.householdInvite.delete({
    where: { id: inviteId },
  });

  revalidatePath("/household");
  return { success: true };
}

export async function removeMember(userId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Grupo não encontrado" };
  }

  if (userId === session.user.id) {
    return { error: "Você não pode remover a si mesmo" };
  }

  // Only the household owner can remove members
  const household = await prisma.household.findUnique({
    where: { id: session.user.householdId },
    select: { ownerId: true },
  });
  if (!household || household.ownerId !== session.user.id) {
    return { error: "Apenas o dono do grupo pode remover membros" };
  }

  // Verify the user being removed belongs to this household
  const userToRemove = await prisma.user.findUnique({
    where: { id: userId },
    select: { householdId: true },
  });
  if (!userToRemove || userToRemove.householdId !== session.user.householdId) {
    return { error: "Usuário não encontrado neste grupo" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const newHousehold = await tx.household.create({
        data: { name: DEFAULT_HOUSEHOLD_NAME, ownerId: userId },
      });
      await tx.user.update({
        where: { id: userId, householdId: session.user.householdId },
        data: { householdId: newHousehold.id },
      });
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({ ...c, householdId: newHousehold.id })),
      });
      await tx.household.update({
        where: { id: session.user.householdId! },
        data: { defaultSplitRatio: Prisma.DbNull },
      });
    });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return { error: "Erro ao remover membro. Tente novamente." };
  }

  revalidatePath("/household");
  return { success: true };
}

export async function cleanupExpiredInvites() {
  await prisma.householdInvite.deleteMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
  });
}

export async function updateDefaultSplitRatio(ratio: Record<string, number> | null) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  if (ratio !== null) {
    const parsed = defaultSplitRatioSchema.safeParse(ratio);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const memberIds = Object.keys(parsed.data);
    const validMembers = await prisma.user.count({
      where: { id: { in: memberIds }, householdId },
    });
    if (validMembers !== memberIds.length) {
      return { error: "Membro não encontrado no grupo" };
    }
  }

  try {
    await prisma.household.update({
      where: { id: householdId },
      data: { defaultSplitRatio: ratio ?? Prisma.DbNull },
    });
  } catch (error) {
    console.error("Failed to update split ratio:", error);
    return { error: "Erro ao salvar proporção. Tente novamente." };
  }

  revalidatePath("/household");
  return { success: true };
}
