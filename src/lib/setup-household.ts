import { prisma } from "@/lib/prisma";
import { TransactionType } from "@prisma/client";

const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "utensils", color: "#ef4444", type: TransactionType.EXPENSE },
  { name: "Transporte", icon: "car", color: "#f97316", type: TransactionType.EXPENSE },
  { name: "Moradia", icon: "home", color: "#eab308", type: TransactionType.EXPENSE },
  { name: "Saúde", icon: "heart-pulse", color: "#22c55e", type: TransactionType.EXPENSE },
  { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: TransactionType.EXPENSE },
  { name: "Outros", icon: "ellipsis", color: "#6b7280", type: TransactionType.EXPENSE },
  { name: "Salário", icon: "banknote", color: "#10b981", type: TransactionType.INCOME },
  { name: "Freelance", icon: "laptop", color: "#06b6d4", type: TransactionType.INCOME },
  { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: TransactionType.INCOME },
];

export async function createHouseholdForUser(userId: string, userName: string) {
  const household = await prisma.household.create({
    data: { name: `Casa de ${userName}` },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { householdId: household.id },
  });

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      householdId: household.id,
    })),
  });

  return household.id;
}
