"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod/v4";

const inviteSchema = z.object({
  email: z.email("Email invalido"),
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
    return { error: "Household nao encontrado" };
  }

  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (!user) {
    return { error: "Usuario nao encontrado. Ele precisa criar uma conta primeiro." };
  }

  if (user.householdId === session.user.householdId) {
    return { error: "Usuario ja faz parte deste household" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { householdId: session.user.householdId },
  });

  revalidatePath("/household");
  return { success: true };
}

export async function removeMember(userId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  if (userId === session.user.id) {
    return { error: "Voce nao pode remover a si mesmo" };
  }

  const newHousehold = await prisma.household.create({
    data: { name: "Minha Casa" },
  });

  await prisma.user.update({
    where: { id: userId, householdId: session.user.householdId },
    data: { householdId: newHousehold.id },
  });

  revalidatePath("/household");
  return { success: true };
}
