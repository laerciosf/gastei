"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { DEFAULT_CATEGORIES, householdNameFor } from "@/lib/setup-household";

export async function register(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const rl = checkRateLimit(`register:${parsed.data.email}`, 5, 60_000 * 15);
  if (!rl.allowed) {
    return { error: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
        },
      });
      const household = await tx.household.create({
        data: { name: householdNameFor(parsed.data.name), ownerId: user.id },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { householdId: household.id },
      });
      await tx.category.createMany({
        data: DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          householdId: household.id,
        })),
      });
    });
  } catch (error) {
    console.error("Failed to register user:", error);
    return { error: "Erro ao criar conta. Tente novamente." };
  }

  return signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
}
