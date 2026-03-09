import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

export const DEFAULT_HOUSEHOLD_NAME = "Minha Casa";

export function householdNameFor(userName: string): string {
  return `Casa de ${userName}`;
}

export const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "utensils", color: "#ef4444", type: TransactionType.EXPENSE },
  { name: "Transporte", icon: "car", color: "#f97316", type: TransactionType.EXPENSE },
  { name: "Moradia", icon: "home", color: "#eab308", type: TransactionType.EXPENSE },
  { name: "Saúde", icon: "heart-pulse", color: "#22c55e", type: TransactionType.EXPENSE },
  { name: "Educação", icon: "graduation-cap", color: "#3b82f6", type: TransactionType.EXPENSE },
  { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: TransactionType.EXPENSE },
  { name: "Vestuário", icon: "shirt", color: "#ec4899", type: TransactionType.EXPENSE },
  { name: "Outros", icon: "ellipsis", color: "#6b7280", type: TransactionType.EXPENSE },
  { name: "Salário", icon: "banknote", color: "#10b981", type: TransactionType.INCOME },
  { name: "Freelance", icon: "laptop", color: "#06b6d4", type: TransactionType.INCOME },
  { name: "Investimentos", icon: "trending-up", color: "#14b8a6", type: TransactionType.INCOME },
  { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: TransactionType.INCOME },
];

export async function seedDefaultCategories(householdId: string) {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      householdId,
    })),
  });
}

export async function createHouseholdForUser(userId: string, userName: string) {
  return prisma.$transaction(async (tx) => {
    const household = await tx.household.create({
      data: { name: householdNameFor(userName), ownerId: userId },
    });
    await tx.user.update({
      where: { id: userId },
      data: { householdId: household.id },
    });
    await tx.category.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        ...c,
        householdId: household.id,
      })),
    });
    return household.id;
  });
}
