"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function getHousehold() {
  const session = await requireAuth();
  if (!session.user.householdId) return null;

  return prisma.household.findUnique({
    where: { id: session.user.householdId },
  });
}
