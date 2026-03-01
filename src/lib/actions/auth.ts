"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { TransactionType } from "@/generated/prisma";

export async function register(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existingUser) {
    return { error: "Email ja cadastrado" };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const household = await prisma.household.create({
    data: { name: `Casa de ${parsed.data.name}` },
  });

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      householdId: household.id,
    },
  });

  const DEFAULT_CATEGORIES = [
    { name: "Alimentacao", icon: "utensils", color: "#ef4444", type: TransactionType.EXPENSE },
    { name: "Transporte", icon: "car", color: "#f97316", type: TransactionType.EXPENSE },
    { name: "Moradia", icon: "home", color: "#eab308", type: TransactionType.EXPENSE },
    { name: "Saude", icon: "heart-pulse", color: "#22c55e", type: TransactionType.EXPENSE },
    { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: TransactionType.EXPENSE },
    { name: "Outros", icon: "ellipsis", color: "#6b7280", type: TransactionType.EXPENSE },
    { name: "Salario", icon: "banknote", color: "#10b981", type: TransactionType.INCOME },
    { name: "Freelance", icon: "laptop", color: "#06b6d4", type: TransactionType.INCOME },
    { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: TransactionType.INCOME },
  ];

  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((cat) => ({
      ...cat,
      householdId: household.id,
    })),
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
}
