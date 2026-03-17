import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth.config";
import { createHouseholdForUser } from "@/lib/setup-household";
import { checkRateLimit } from "@/lib/rate-limit";
import { getGoogleCredentials } from "@/lib/env";

const google = getGoogleCredentials();

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: google.clientId,
      clientSecret: google.clientSecret,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const rl = checkRateLimit(`login:${parsed.data.email}`, 10, 60_000 * 15);
        if (!rl.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await verifyPassword(
          parsed.data.password,
          user.passwordHash
        );

        if (!isValid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.householdId !== undefined) {
        const dbUserUpdate = await prisma.user.findUnique({
          where: { id: token.sub! },
          select: { householdId: true },
        });
        if (dbUserUpdate && dbUserUpdate.householdId === session.householdId) {
          token.householdId = session.householdId;
        }
        return token;
      }
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id! },
          select: { householdId: true, name: true },
        });

        if (!dbUser?.householdId) {
          token.householdId = await createHouseholdForUser(
            user.id!,
            dbUser?.name ?? user.name ?? "Meu"
          );
        } else {
          token.householdId = dbUser.householdId;
        }
      } else if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { householdId: true },
        });
        token.householdId = dbUser?.householdId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        session.user.householdId = token.householdId as string | null;
      }
      return session;
    },
  },
});
