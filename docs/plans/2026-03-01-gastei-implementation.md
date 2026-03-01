# Gastei — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a personal finance management web app with expense/income tracking, budgeting, and multi-user household support.

**Architecture:** Next.js 15 full-stack app using App Router with Server Components and Server Actions. Prisma ORM with PostgreSQL (Neon). NextAuth.js v5 for authentication. Multi-tenancy via shared schema isolated by `householdId`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, shadcn/ui, Prisma, NextAuth.js v5, Zod, Recharts, Vitest, PostgreSQL (Neon)

**Package Manager:** pnpm

**Project Directory:** `~/dev/pessoal/gastei`

**Design Doc:** `docs/plans/2026-03-01-gastei-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `vitest.config.ts`

**Step 1: Create Next.js project**

```bash
cd ~/dev/pessoal/gastei
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
```

This will scaffold the project. Accept overwriting existing files if prompted.

**Step 2: Install core dependencies**

```bash
pnpm add prisma @prisma/client next-auth@beta @auth/prisma-adapter zod recharts date-fns lucide-react
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/react @types/node
```

**Step 3: Install and initialize shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```

Then add base components:

```bash
pnpm dlx shadcn@latest add button input label card dialog select dropdown-menu avatar badge separator sheet tabs toast form popover calendar command
```

**Step 4: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `src/test/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

**Step 5: Create `.env.example`**

```env
DATABASE_URL="postgresql://user:password@host:5432/gastei?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

**Step 6: Run tests to verify setup**

```bash
pnpm test:run
```

Expected: 0 tests found, no errors. Vitest runs successfully.

**Step 7: Verify dev server starts**

```bash
pnpm dev &
sleep 5
curl -s http://localhost:3000 | head -5
kill %1
```

Expected: HTML output from Next.js default page.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with core dependencies"
```

---

## Task 2: Prisma Schema & Database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`

**Step 1: Initialize Prisma**

```bash
pnpm prisma init
```

**Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  passwordHash  String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  householdId String?
  household   Household? @relation(fields: [householdId], references: [id])

  transactions Transaction[]
  accounts     Account[]
  sessions     Session[]

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

model Household {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())

  members      User[]
  categories   Category[]
  transactions Transaction[]
  budgets      Budget[]

  @@map("households")
}

enum TransactionType {
  INCOME
  EXPENSE
}

model Category {
  id    String          @id @default(cuid())
  name  String
  icon  String          @default("circle")
  color String          @default("#6b7280")
  type  TransactionType

  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  transactions Transaction[]
  budgets      Budget[]

  @@unique([name, householdId])
  @@map("categories")
}

model Transaction {
  id          String          @id @default(cuid())
  description String
  amount      Int             // centavos
  type        TransactionType
  date        DateTime
  createdAt   DateTime        @default(now())

  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])

  userId      String
  user        User @relation(fields: [userId], references: [id])

  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@index([householdId, date])
  @@index([householdId, categoryId])
  @@map("transactions")
}

model Budget {
  id     String @id @default(cuid())
  month  String // YYYY-MM
  amount Int    // centavos

  categoryId  String
  category    Category @relation(fields: [categoryId], references: [id])

  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  @@unique([month, categoryId, householdId])
  @@map("budgets")
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Create seed script**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  { name: "Alimentacao", icon: "utensils", color: "#ef4444", type: TransactionType.EXPENSE },
  { name: "Transporte", icon: "car", color: "#f97316", type: TransactionType.EXPENSE },
  { name: "Moradia", icon: "home", color: "#eab308", type: TransactionType.EXPENSE },
  { name: "Saude", icon: "heart-pulse", color: "#22c55e", type: TransactionType.EXPENSE },
  { name: "Educacao", icon: "graduation-cap", color: "#3b82f6", type: TransactionType.EXPENSE },
  { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: TransactionType.EXPENSE },
  { name: "Vestuario", icon: "shirt", color: "#ec4899", type: TransactionType.EXPENSE },
  { name: "Outros", icon: "ellipsis", color: "#6b7280", type: TransactionType.EXPENSE },
  { name: "Salario", icon: "banknote", color: "#10b981", type: TransactionType.INCOME },
  { name: "Freelance", icon: "laptop", color: "#06b6d4", type: TransactionType.INCOME },
  { name: "Investimentos", icon: "trending-up", color: "#14b8a6", type: TransactionType.INCOME },
  { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: TransactionType.INCOME },
];

async function main() {
  console.log("Seeding database...");

  const household = await prisma.household.create({
    data: { name: "Minha Casa" },
  });

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.create({
      data: { ...cat, householdId: household.id },
    });
  }

  console.log(`Created household: ${household.id}`);
  console.log(`Created ${DEFAULT_CATEGORIES.length} default categories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Install tsx:

```bash
pnpm add -D tsx
```

**Step 5: Generate Prisma client (no DB needed yet)**

```bash
pnpm prisma generate
```

Expected: Prisma Client generated successfully.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Prisma schema with all data models and seed script"
```

---

## Task 3: Authentication (NextAuth.js v5)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/lib/actions/auth.ts`
- Test: `src/lib/actions/__tests__/auth.test.ts`

**Step 1: Write test for password hashing utility**

Create `src/lib/__tests__/password.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password utilities", () => {
  it("should hash a password", async () => {
    const hash = await hashPassword("my-secret-password");
    expect(hash).toBeDefined();
    expect(hash).not.toBe("my-secret-password");
  });

  it("should verify a correct password", async () => {
    const hash = await hashPassword("my-secret-password");
    const isValid = await verifyPassword("my-secret-password", hash);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const hash = await hashPassword("my-secret-password");
    const isValid = await verifyPassword("wrong-password", hash);
    expect(isValid).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test:run src/lib/__tests__/password.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement password utilities**

Install bcryptjs:

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

Create `src/lib/password.ts`:

```typescript
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test:run src/lib/__tests__/password.test.ts
```

Expected: 3 tests PASS.

**Step 5: Write validation schemas**

Create `src/lib/validations/auth.ts`:

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
```

**Step 6: Write test for validation schemas**

Create `src/lib/validations/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts valid input", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      name: "John",
      email: "john@example.com",
      password: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = registerSchema.safeParse({
      name: "J",
      email: "john@example.com",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 7: Run validation tests**

```bash
pnpm test:run src/lib/validations/__tests__/auth.test.ts
```

Expected: 5 tests PASS.

**Step 8: Configure NextAuth.js v5**

Create `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { loginSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

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
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { householdId: true },
        });
        token.householdId = dbUser?.householdId;
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
```

Create `src/types/next-auth.d.ts`:

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      householdId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    householdId?: string | null;
  }
}
```

**Step 9: Create auth API route**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 10: Create register server action**

Create `src/lib/actions/auth.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { registerSchema } from "@/lib/validations/auth";
import { signIn } from "@/lib/auth";

export async function register(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
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

  // Create default categories for the new household
  const DEFAULT_CATEGORIES = [
    { name: "Alimentacao", icon: "utensils", color: "#ef4444", type: "EXPENSE" as const },
    { name: "Transporte", icon: "car", color: "#f97316", type: "EXPENSE" as const },
    { name: "Moradia", icon: "home", color: "#eab308", type: "EXPENSE" as const },
    { name: "Saude", icon: "heart-pulse", color: "#22c55e", type: "EXPENSE" as const },
    { name: "Lazer", icon: "gamepad-2", color: "#8b5cf6", type: "EXPENSE" as const },
    { name: "Outros", icon: "ellipsis", color: "#6b7280", type: "EXPENSE" as const },
    { name: "Salario", icon: "banknote", color: "#10b981", type: "INCOME" as const },
    { name: "Freelance", icon: "laptop", color: "#06b6d4", type: "INCOME" as const },
    { name: "Outros (Receita)", icon: "plus-circle", color: "#6b7280", type: "INCOME" as const },
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
```

**Step 11: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha incorretos");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Entrar no Gastei</CardTitle>
          <CardDescription>Acesse sua conta para gerenciar suas financas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            Entrar com Google
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nao tem conta?{" "}
            <Link href="/register" className="text-primary underline">
              Cadastre-se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 12: Create register page**

Create `src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { register } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await register(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Criar conta no Gastei</CardTitle>
          <CardDescription>Comece a controlar suas financas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Ja tem conta?{" "}
            <Link href="/login" className="text-primary underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 13: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS (password + validation).

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: add authentication with NextAuth.js v5, login and register pages"
```

---

## Task 4: App Layout & Navigation

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/sidebar.tsx`
- Create: `src/components/header.tsx`
- Create: `src/components/theme-provider.tsx`
- Create: `src/app/(app)/dashboard/page.tsx` (placeholder)
- Modify: `src/app/layout.tsx`

**Step 1: Install next-themes**

```bash
pnpm add next-themes
```

**Step 2: Create theme provider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

**Step 3: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gastei",
  description: "Controle financeiro pessoal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 4: Create auth guard helper**

Create `src/lib/auth-guard.ts`:

```typescript
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
```

**Step 5: Create sidebar component**

Create `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, Tag, Target, Users, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transacoes", icon: ArrowLeftRight },
  { href: "/categories", label: "Categorias", icon: Tag },
  { href: "/budget", label: "Orcamento", icon: Target },
  { href: "/household", label: "Household", icon: Users },
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">Gastei</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
```

**Step 6: Create header component**

Create `src/components/header.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Header() {
  const session = await auth();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{session?.user?.name}</span>
        </div>
      </div>
    </header>
  );
}
```

Create `src/components/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}
```

**Step 7: Create app layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { requireAuth } from "@/lib/auth-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
```

**Step 8: Create dashboard placeholder**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <p className="text-muted-foreground">Em breve...</p>
    </div>
  );
}
```

**Step 9: Update root page to redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  redirect("/login");
}
```

**Step 10: Commit**

```bash
git add -A
git commit -m "feat: add app layout with sidebar, header, theme toggle"
```

---

## Task 5: Categories CRUD

**Files:**
- Create: `src/lib/actions/categories.ts`
- Create: `src/lib/actions/__tests__/categories.test.ts`
- Create: `src/lib/validations/category.ts`
- Create: `src/app/(app)/categories/page.tsx`
- Create: `src/components/category-form.tsx`

**Step 1: Write validation schema**

Create `src/lib/validations/category.ts`:

```typescript
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(50),
  icon: z.string().default("circle"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor invalida"),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export type CategoryInput = z.infer<typeof categorySchema>;
```

**Step 2: Write validation tests**

Create `src/lib/validations/__tests__/category.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { categorySchema } from "@/lib/validations/category";

describe("categorySchema", () => {
  it("accepts valid expense category", () => {
    const result = categorySchema.safeParse({
      name: "Alimentacao",
      icon: "utensils",
      color: "#ef4444",
      type: "EXPENSE",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid income category", () => {
    const result = categorySchema.safeParse({
      name: "Salario",
      icon: "banknote",
      color: "#10b981",
      type: "INCOME",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = categorySchema.safeParse({
      name: "",
      icon: "circle",
      color: "#000000",
      type: "EXPENSE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      icon: "circle",
      color: "red",
      type: "EXPENSE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = categorySchema.safeParse({
      name: "Test",
      icon: "circle",
      color: "#000000",
      type: "TRANSFER",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 3: Run tests**

```bash
pnpm test:run src/lib/validations/__tests__/category.test.ts
```

Expected: 5 tests PASS.

**Step 4: Create server actions for categories**

Create `src/lib/actions/categories.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { categorySchema } from "@/lib/validations/category";

export async function getCategories() {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.category.findMany({
    where: { householdId: session.user.householdId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function createCategory(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || "circle",
    color: formData.get("color"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.category.create({
    data: {
      ...parsed.data,
      householdId: session.user.householdId,
    },
  });

  revalidatePath("/categories");
  return { success: true };
}

export async function updateCategory(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || "circle",
    color: formData.get("color"),
    type: formData.get("type"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.category.update({
    where: { id, householdId: session.user.householdId },
    data: parsed.data,
  });

  revalidatePath("/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const hasTransactions = await prisma.transaction.count({
    where: { categoryId: id },
  });

  if (hasTransactions > 0) {
    return { error: "Categoria possui transacoes vinculadas" };
  }

  await prisma.category.delete({
    where: { id, householdId: session.user.householdId },
  });

  revalidatePath("/categories");
  return { success: true };
}
```

**Step 5: Create category form component**

Create `src/components/category-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCategory, updateCategory } from "@/lib/actions/categories";

interface CategoryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: { id: string; name: string; icon: string; color: string; type: string } | null;
}

export function CategoryForm({ open, onOpenChange, category }: CategoryFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEditing = !!category;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = isEditing
      ? await updateCategory(category!.id, formData)
      : await createCategory(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onOpenChange(false);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Nova"} Categoria</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={category?.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue={category?.type ?? "EXPENSE"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Despesa</SelectItem>
                <SelectItem value="INCOME">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Cor</Label>
            <Input id="color" name="color" type="color" defaultValue={category?.color ?? "#6b7280"} />
          </div>
          <input type="hidden" name="icon" value={category?.icon ?? "circle"} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 6: Create categories page**

Create `src/app/(app)/categories/page.tsx`:

```tsx
import { getCategories } from "@/lib/actions/categories";
import { CategoriesList } from "@/components/categories-list";

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Categorias</h2>
      <CategoriesList categories={categories} />
    </div>
  );
}
```

Create `src/components/categories-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryForm } from "@/components/category-form";
import { deleteCategory } from "@/lib/actions/categories";

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: string;
}

export function CategoriesList({ categories }: { categories: Category[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");
  const incomeCategories = categories.filter((c) => c.type === "INCOME");

  function handleEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;
    const result = await deleteCategory(id);
    if (result.error) alert(result.error);
  }

  function renderCategory(category: Category) {
    return (
      <div key={category.id} className="flex items-center justify-between rounded-md border p-3">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="font-medium">{category.name}</span>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(category.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={handleNew}>
        <Plus className="mr-2 h-4 w-4" />
        Nova Categoria
      </Button>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Despesas <Badge variant="secondary">{expenseCategories.length}</Badge>
          </h3>
          {expenseCategories.map(renderCategory)}
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">
            Receitas <Badge variant="secondary">{incomeCategories.length}</Badge>
          </h3>
          {incomeCategories.map(renderCategory)}
        </div>
      </div>

      <CategoryForm open={formOpen} onOpenChange={setFormOpen} category={editing} />
    </>
  );
}
```

**Step 7: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add categories CRUD with validation and UI"
```

---

## Task 6: Transactions CRUD

**Files:**
- Create: `src/lib/validations/transaction.ts`
- Create: `src/lib/validations/__tests__/transaction.test.ts`
- Create: `src/lib/actions/transactions.ts`
- Create: `src/app/(app)/transactions/page.tsx`
- Create: `src/components/transaction-form.tsx`
- Create: `src/components/transactions-list.tsx`
- Create: `src/lib/utils/money.ts`
- Create: `src/lib/utils/__tests__/money.test.ts`

**Step 1: Write money utility tests**

Create `src/lib/utils/__tests__/money.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatCurrency, parseCurrency } from "@/lib/utils/money";

describe("formatCurrency", () => {
  it("formats cents to BRL", () => {
    expect(formatCurrency(15000)).toBe("R$ 150,00");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("R$ 0,00");
  });

  it("formats large values", () => {
    expect(formatCurrency(1000000)).toBe("R$ 10.000,00");
  });
});

describe("parseCurrency", () => {
  it("parses decimal string to cents", () => {
    expect(parseCurrency("150.00")).toBe(15000);
  });

  it("parses integer string", () => {
    expect(parseCurrency("100")).toBe(10000);
  });

  it("parses string with one decimal", () => {
    expect(parseCurrency("10.5")).toBe(1050);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test:run src/lib/utils/__tests__/money.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement money utilities**

Create `src/lib/utils/money.ts`:

```typescript
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseCurrency(value: string): number {
  const num = parseFloat(value);
  return Math.round(num * 100);
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm test:run src/lib/utils/__tests__/money.test.ts
```

Expected: 6 tests PASS.

**Step 5: Write transaction validation schema and tests**

Create `src/lib/validations/transaction.ts`:

```typescript
import { z } from "zod";

export const transactionSchema = z.object({
  description: z.string().min(1, "Descricao e obrigatoria").max(200),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.string().min(1, "Categoria e obrigatoria"),
  date: z.string().min(1, "Data e obrigatoria"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
```

Create `src/lib/validations/__tests__/transaction.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transactionSchema } from "@/lib/validations/transaction";

describe("transactionSchema", () => {
  it("accepts valid transaction", () => {
    const result = transactionSchema.safeParse({
      description: "Almoco",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty description", () => {
    const result = transactionSchema.safeParse({
      description: "",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = transactionSchema.safeParse({
      description: "Almoco",
      amount: "0",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = transactionSchema.safeParse({
      description: "Almoco",
      amount: "-10",
      type: "EXPENSE",
      categoryId: "cat-123",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", () => {
    const result = transactionSchema.safeParse({
      description: "Almoco",
      amount: "25.50",
      type: "EXPENSE",
      categoryId: "",
      date: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 6: Run validation tests**

```bash
pnpm test:run src/lib/validations/__tests__/transaction.test.ts
```

Expected: 5 tests PASS.

**Step 7: Create transaction server actions**

Create `src/lib/actions/transactions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { transactionSchema } from "@/lib/validations/transaction";
import { parseCurrency } from "@/lib/utils/money";

interface GetTransactionsParams {
  month?: string; // YYYY-MM
  categoryId?: string;
  type?: "INCOME" | "EXPENSE";
  search?: string;
}

export async function getTransactions(params: GetTransactionsParams = {}) {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const where: Record<string, unknown> = {
    householdId: session.user.householdId,
  };

  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    where.date = {
      gte: new Date(year, month - 1, 1),
      lt: new Date(year, month, 1),
    };
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.type) {
    where.type = params.type;
  }

  if (params.search) {
    where.description = { contains: params.search, mode: "insensitive" };
  }

  return prisma.transaction.findMany({
    where,
    include: { category: true, user: { select: { name: true } } },
    orderBy: { date: "desc" },
  });
}

export async function createTransaction(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.transaction.create({
    data: {
      description: parsed.data.description,
      amount: parseCurrency(parsed.data.amount),
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      categoryId: parsed.data.categoryId,
      userId: session.user.id,
      householdId: session.user.householdId,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = transactionSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    type: formData.get("type"),
    categoryId: formData.get("categoryId"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.transaction.update({
    where: { id, householdId: session.user.householdId },
    data: {
      description: parsed.data.description,
      amount: parseCurrency(parsed.data.amount),
      type: parsed.data.type,
      date: new Date(parsed.data.date),
      categoryId: parsed.data.categoryId,
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  await prisma.transaction.delete({
    where: { id, householdId: session.user.householdId },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}
```

**Step 8: Create transaction form component**

Create `src/components/transaction-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionData {
  id: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string;
  date: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  transaction?: TransactionData | null;
}

export function TransactionForm({ open, onOpenChange, categories, transaction }: TransactionFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(transaction?.type ?? "EXPENSE");
  const isEditing = !!transaction;

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("type", type);

    const result = isEditing
      ? await updateTransaction(transaction!.id, formData)
      : await createTransaction(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      onOpenChange(false);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Nova"} Transacao</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("EXPENSE")}
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("INCOME")}
            >
              Receita
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Input id="description" name="description" defaultValue={transaction?.description} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={transaction ? (transaction.amount / 100).toFixed(2) : undefined}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <Select name="categoryId" defaultValue={transaction?.categoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={transaction?.date ?? new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 9: Create transactions list component**

Create `src/components/transactions-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionForm } from "@/components/transaction-form";
import { deleteTransaction } from "@/lib/actions/transactions";
import { formatCurrency } from "@/lib/utils/money";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: Date;
  category: { id: string; name: string; color: string; type: string };
  user: { name: string | null };
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
}

export function TransactionsList({ transactions, categories }: TransactionsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  function handleEdit(tx: Transaction) {
    setEditing(tx);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta transacao?")) return;
    await deleteTransaction(id);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transacao
        </Button>
      </div>

      <div className="space-y-2">
        {transactions.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">Nenhuma transacao encontrada</p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tx.category.color }} />
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-sm text-muted-foreground">
                  {tx.category.name} · {format(new Date(tx.date), "dd MMM yyyy", { locale: ptBR })}
                  {tx.user.name && ` · ${tx.user.name}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-semibold ${tx.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
              </span>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(tx)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        transaction={
          editing
            ? {
                id: editing.id,
                description: editing.description,
                amount: editing.amount,
                type: editing.type,
                categoryId: editing.category.id,
                date: new Date(editing.date).toISOString().split("T")[0],
              }
            : null
        }
      />
    </>
  );
}
```

**Step 10: Create transactions page**

Create `src/app/(app)/transactions/page.tsx`:

```tsx
import { getTransactions } from "@/lib/actions/transactions";
import { getCategories } from "@/lib/actions/categories";
import { TransactionsList } from "@/components/transactions-list";

interface Props {
  searchParams: Promise<{ month?: string; categoryId?: string; type?: string; search?: string }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7);

  const [transactions, categories] = await Promise.all([
    getTransactions({
      month: currentMonth,
      categoryId: params.categoryId,
      type: params.type as "INCOME" | "EXPENSE" | undefined,
      search: params.search,
    }),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transacoes</h2>
      <TransactionsList transactions={transactions} categories={categories} />
    </div>
  );
}
```

**Step 11: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 12: Commit**

```bash
git add -A
git commit -m "feat: add transactions CRUD with filtering and money utilities"
```

---

## Task 7: Dashboard

**Files:**
- Create: `src/lib/actions/dashboard.ts`
- Modify: `src/app/(app)/dashboard/page.tsx`
- Create: `src/components/dashboard/summary-cards.tsx`
- Create: `src/components/dashboard/category-chart.tsx`
- Create: `src/components/dashboard/recent-transactions.tsx`

**Step 1: Create dashboard data fetching**

Create `src/lib/actions/dashboard.ts`:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export interface MonthlySummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: { name: string; color: string; total: number; type: string }[];
}

export async function getMonthlySummary(month?: string): Promise<MonthlySummary> {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { totalIncome: 0, totalExpense: 0, balance: 0, byCategory: [] };
  }

  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId: session.user.householdId,
      date: { gte: startDate, lt: endDate },
    },
    include: { category: true },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryMap = new Map<string, { name: string; color: string; total: number; type: string }>();

  for (const tx of transactions) {
    if (tx.type === "INCOME") {
      totalIncome += tx.amount;
    } else {
      totalExpense += tx.amount;
    }

    const existing = categoryMap.get(tx.categoryId);
    if (existing) {
      existing.total += tx.amount;
    } else {
      categoryMap.set(tx.categoryId, {
        name: tx.category.name,
        color: tx.category.color,
        total: tx.amount,
        type: tx.type,
      });
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
  };
}

export async function getRecentTransactions(limit = 5) {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  return prisma.transaction.findMany({
    where: { householdId: session.user.householdId },
    include: { category: true, user: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: limit,
  });
}
```

**Step 2: Create summary cards component**

Create `src/components/dashboard/summary-cards.tsx`:

```tsx
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";

interface SummaryCardsProps {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export function SummaryCards({ totalIncome, totalExpense, balance }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Receitas</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Despesas</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Saldo</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatCurrency(Math.abs(balance))}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Create category chart component**

Create `src/components/dashboard/category-chart.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";

interface CategoryData {
  name: string;
  color: string;
  total: number;
  type: string;
}

export function CategoryChart({ data }: { data: CategoryData[] }) {
  const expenses = data.filter((d) => d.type === "EXPENSE");

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">Sem despesas neste mes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Despesas por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={expenses}
              dataKey="total"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {expenses.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create recent transactions component**

Create `src/components/dashboard/recent-transactions.tsx`:

```tsx
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: Date;
  category: { name: string; color: string };
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transacoes Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">Nenhuma transacao ainda</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tx.category.color }} />
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), "dd MMM", { locale: ptBR })} · {tx.category.name}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${tx.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                  {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 5: Update dashboard page**

Replace `src/app/(app)/dashboard/page.tsx`:

```tsx
import { getMonthlySummary, getRecentTransactions } from "@/lib/actions/dashboard";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default async function DashboardPage() {
  const [summary, recentTransactions] = await Promise.all([
    getMonthlySummary(),
    getRecentTransactions(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>
      <SummaryCards
        totalIncome={summary.totalIncome}
        totalExpense={summary.totalExpense}
        balance={summary.balance}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryChart data={summary.byCategory} />
        <RecentTransactions transactions={recentTransactions} />
      </div>
    </div>
  );
}
```

**Step 6: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with summary cards, category chart, recent transactions"
```

---

## Task 8: Budget Management

**Files:**
- Create: `src/lib/validations/budget.ts`
- Create: `src/lib/validations/__tests__/budget.test.ts`
- Create: `src/lib/actions/budget.ts`
- Create: `src/app/(app)/budget/page.tsx`
- Create: `src/components/budget-list.tsx`

**Step 1: Write budget validation schema and tests**

Create `src/lib/validations/budget.ts`:

```typescript
import { z } from "zod";

export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato invalido (YYYY-MM)"),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  categoryId: z.string().min(1, "Categoria e obrigatoria"),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
```

Create `src/lib/validations/__tests__/budget.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { budgetSchema } from "@/lib/validations/budget";

describe("budgetSchema", () => {
  it("accepts valid budget", () => {
    const result = budgetSchema.safeParse({
      month: "2026-03",
      amount: "500.00",
      categoryId: "cat-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid month format", () => {
    const result = budgetSchema.safeParse({
      month: "March 2026",
      amount: "500.00",
      categoryId: "cat-123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = budgetSchema.safeParse({
      month: "2026-03",
      amount: "0",
      categoryId: "cat-123",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests**

```bash
pnpm test:run src/lib/validations/__tests__/budget.test.ts
```

Expected: 3 tests PASS.

**Step 3: Create budget server actions**

Create `src/lib/actions/budget.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { budgetSchema } from "@/lib/validations/budget";
import { parseCurrency } from "@/lib/utils/money";

export interface BudgetWithSpent {
  id: string;
  month: string;
  amount: number;
  spent: number;
  category: { id: string; name: string; color: string };
}

export async function getBudgets(month?: string): Promise<BudgetWithSpent[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const targetMonth = month ?? new Date().toISOString().slice(0, 7);
  const [year, mon] = targetMonth.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 1);

  const budgets = await prisma.budget.findMany({
    where: { householdId: session.user.householdId, month: targetMonth },
    include: { category: true },
  });

  const spentByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      householdId: session.user.householdId,
      type: "EXPENSE",
      date: { gte: startDate, lt: endDate },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(spentByCategory.map((s) => [s.categoryId, s._sum.amount ?? 0]));

  return budgets.map((b) => ({
    id: b.id,
    month: b.month,
    amount: b.amount,
    spent: spentMap.get(b.categoryId) ?? 0,
    category: { id: b.category.id, name: b.category.name, color: b.category.color },
  }));
}

export async function upsertBudget(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const parsed = budgetSchema.safeParse({
    month: formData.get("month"),
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.budget.upsert({
    where: {
      month_categoryId_householdId: {
        month: parsed.data.month,
        categoryId: parsed.data.categoryId,
        householdId: session.user.householdId,
      },
    },
    update: { amount: parseCurrency(parsed.data.amount) },
    create: {
      month: parsed.data.month,
      amount: parseCurrency(parsed.data.amount),
      categoryId: parsed.data.categoryId,
      householdId: session.user.householdId,
    },
  });

  revalidatePath("/budget");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  await prisma.budget.delete({
    where: { id, householdId: session.user.householdId },
  });

  revalidatePath("/budget");
  return { success: true };
}
```

**Step 4: Create budget list component**

Create `src/components/budget-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import { upsertBudget, deleteBudget, type BudgetWithSpent } from "@/lib/actions/budget";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface BudgetListProps {
  budgets: BudgetWithSpent[];
  categories: Category[];
  currentMonth: string;
}

export function BudgetList({ budgets, categories, currentMonth }: BudgetListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("month", currentMonth);

    const result = await upsertBudget(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setFormOpen(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este orcamento?")) return;
    await deleteBudget(id);
  }

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Definir Orcamento
      </Button>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const percentage = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 0;
          const isOverBudget = budget.spent > budget.amount;

          return (
            <Card key={budget.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: budget.category.color }} />
                    <span className="font-medium">{budget.category.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span>{formatCurrency(budget.spent)}</span>
                    <span className="text-muted-foreground">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${isOverBudget ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {isOverBudget && (
                    <p className="mt-1 text-xs text-red-500">
                      Excedido em {formatCurrency(budget.spent - budget.amount)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nenhum orcamento definido para este mes</p>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Orcamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria</Label>
              <Select name="categoryId">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Limite (R$)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 5: Create budget page**

Create `src/app/(app)/budget/page.tsx`:

```tsx
import { getBudgets } from "@/lib/actions/budget";
import { getCategories } from "@/lib/actions/categories";
import { BudgetList } from "@/components/budget-list";

export default async function BudgetPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [budgets, categories] = await Promise.all([
    getBudgets(currentMonth),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Orcamento — {currentMonth}</h2>
      <BudgetList budgets={budgets} categories={categories} currentMonth={currentMonth} />
    </div>
  );
}
```

**Step 6: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add budget management with progress tracking"
```

---

## Task 9: Household Management

**Files:**
- Create: `src/lib/actions/household.ts`
- Create: `src/app/(app)/household/page.tsx`
- Create: `src/components/household-members.tsx`

**Step 1: Create household server actions**

Create `src/lib/actions/household.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("Email invalido"),
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
    return { error: parsed.error.errors[0].message };
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

  // Create a new household for the removed user
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

export async function updateHouseholdName(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) {
    return { error: "Household nao encontrado" };
  }

  const name = formData.get("name") as string;
  if (!name || name.length < 2) {
    return { error: "Nome deve ter pelo menos 2 caracteres" };
  }

  await prisma.household.update({
    where: { id: session.user.householdId },
    data: { name },
  });

  revalidatePath("/household");
  return { success: true };
}
```

**Step 2: Create household members component**

Create `src/components/household-members.tsx`:

```tsx
"use client";

import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteMember, removeMember, updateHouseholdName } from "@/lib/actions/household";

interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Household {
  id: string;
  name: string;
  members: Member[];
}

export function HouseholdMembers({ household, currentUserId }: { household: Household; currentUserId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await inviteMember(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setInviteOpen(false);
    }
    setLoading(false);
  }

  async function handleRemove(userId: string, name: string | null) {
    if (!confirm(`Remover ${name ?? "este membro"} do household?`)) return;
    const result = await removeMember(userId);
    if (result.error) alert(result.error);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {household.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.name ?? "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              {member.id !== currentUserId && (
                <Button variant="ghost" size="icon" onClick={() => handleRemove(member.id, member.name)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={() => setInviteOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Convidar Membro
      </Button>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email do membro</Label>
              <Input id="email" name="email" type="email" placeholder="membro@email.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Convidando..." : "Convidar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 3: Create household page**

Create `src/app/(app)/household/page.tsx`:

```tsx
import { getHousehold } from "@/lib/actions/household";
import { requireAuth } from "@/lib/auth-guard";
import { HouseholdMembers } from "@/components/household-members";

export default async function HouseholdPage() {
  const session = await requireAuth();
  const household = await getHousehold();

  if (!household) {
    return (
      <div>
        <h2 className="text-2xl font-bold">Household</h2>
        <p className="text-muted-foreground">Nenhum household encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Household</h2>
      <HouseholdMembers household={household} currentUserId={session.user.id} />
    </div>
  );
}
```

**Step 4: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add household management with member invite/remove"
```

---

## Task 10: Settings Page

**Files:**
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/lib/actions/settings.ts`

**Step 1: Create settings server action**

Create `src/lib/actions/settings.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export async function updateProfile(formData: FormData) {
  const session = await requireAuth();

  const parsed = profileSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
  });

  revalidatePath("/settings");
  return { success: true };
}
```

**Step 2: Create settings page**

Create `src/app/(app)/settings/page.tsx`:

```tsx
import { requireAuth } from "@/lib/auth-guard";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await requireAuth();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Configuracoes</h2>
      <SettingsForm user={{ name: session.user.name ?? "", email: session.user.email ?? "" }} />
    </div>
  );
}
```

Create `src/components/settings-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfile } from "@/lib/actions/settings";

export function SettingsForm({ user }: { user: { name: string; email: string } }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateProfile(formData);

    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage("Perfil atualizado com sucesso");
    }
    setLoading(false);
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div className="rounded-md bg-primary/10 p-3 text-sm">{message}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={user.name} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} disabled />
            <p className="text-xs text-muted-foreground">Email nao pode ser alterado</p>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add settings page with profile editing"
```

---

## Task 11: Middleware & Final Wiring

**Files:**
- Create: `src/middleware.ts`
- Modify: `src/app/page.tsx` (already done in Task 4)

**Step 1: Create Next.js middleware for auth**

Create `src/middleware.ts`:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 2: Run all tests**

```bash
pnpm test:run
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add auth middleware for route protection"
```

---

## Task 12: Database Setup & Smoke Test

**Step 1: Set up Neon database**

1. Go to https://neon.tech and create a free project called "gastei"
2. Copy the connection string
3. Create `.env` file (DO NOT commit):

```env
DATABASE_URL="postgresql://...your-neon-connection-string..."
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="run-openssl-rand-base64-32-to-generate"
```

**Step 2: Run migrations**

```bash
pnpm prisma db push
```

Expected: Schema synced with database.

**Step 3: Seed the database**

```bash
pnpm prisma db seed
```

Expected: Default categories created.

**Step 4: Start dev server and smoke test**

```bash
pnpm dev
```

Manual checks:
1. Open http://localhost:3000 — should redirect to /login
2. Click "Cadastre-se" — register with name/email/password
3. Should redirect to /dashboard — empty summary
4. Navigate to Categorias — should see default categories
5. Navigate to Transacoes — add a test transaction
6. Go back to Dashboard — should show the transaction in summary
7. Navigate to Orcamento — add a budget for a category
8. Navigate to Household — should see your name
9. Toggle dark/light theme

**Step 5: Commit .env.example update if needed**

```bash
git add -A
git commit -m "chore: finalize project setup and verify all features work"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|-------------|-----------------|
| 1 | Project Scaffolding | 8 |
| 2 | Prisma Schema & Database | 6 |
| 3 | Authentication | 14 |
| 4 | App Layout & Navigation | 10 |
| 5 | Categories CRUD | 8 |
| 6 | Transactions CRUD | 12 |
| 7 | Dashboard | 7 |
| 8 | Budget Management | 7 |
| 9 | Household Management | 5 |
| 10 | Settings Page | 4 |
| 11 | Middleware & Final Wiring | 3 |
| 12 | Database Setup & Smoke Test | 5 |

**Total: 12 tasks, ~89 steps**
