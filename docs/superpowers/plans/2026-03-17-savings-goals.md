# Savings Goals Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add savings goals (accumulation + spending reduction) with manual deposits, optional deadlines, and progress tracking.

**Architecture:** Single `SavingsGoal` model with `GoalType` enum (SAVINGS/SPENDING) and `GoalEntry` for deposit/withdrawal history. Denormalized `currentAmount` updated via Prisma transactions. Server actions follow existing pattern (requireAuth + Zod validation + revalidatePath). UI follows existing card grid + dialog patterns from budget page.

**Tech Stack:** Prisma 7, Next.js 16 Server Actions, Zod v4, shadcn/ui, Tailwind CSS v4, Lucide icons.

**Spec:** `docs/superpowers/specs/2026-03-17-savings-goals-design.md`

---

## File Structure

### New Files
- `src/lib/validations/goal.ts` — Zod schemas for goal + entry
- `src/lib/actions/goals.ts` — Server actions (CRUD goals, entries, dashboard summary)
- `src/components/goal-form.tsx` — Dialog for create/edit goal
- `src/components/goal-list.tsx` — Cards grid with filter tabs + detail expansion
- `src/components/goal-entry-form.tsx` — Inline form for deposit/withdrawal
- `src/components/dashboard/goals-summary.tsx` — Dashboard widget (top 3 goals)
- `src/app/(app)/goals/page.tsx` — Goals page route
- `src/app/(app)/goals/loading.tsx` — Loading skeleton
- `src/lib/validations/__tests__/goal.test.ts` — Validation tests

### Modified Files
- `prisma/schema.prisma` — Add GoalType enum, SavingsGoal, GoalEntry models + relations
- `src/types/index.ts` — Add GoalType, SavingsGoal, GoalEntry interfaces
- `src/components/sidebar.tsx` — Add "Metas" nav item
- `src/app/(app)/dashboard/page.tsx` — Add goals summary widget
- `prisma/seed.ts` — Add sample goals + entries

---

## Chunk 1: Data Layer

### Task 1: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add GoalType enum and SavingsGoal + GoalEntry models**

Add after the `TransactionType` enum:

```prisma
enum GoalType {
  SAVINGS
  SPENDING
}
```

Add after the `SplitEntry` model:

```prisma
model SavingsGoal {
  id            String    @id @default(cuid())
  name          String
  type          GoalType
  targetAmount  Int
  currentAmount Int       @default(0)
  targetDate    DateTime?
  icon          String    @default("piggy-bank")
  color         String    @default("#10b981")

  householdId String
  household   Household @relation(fields: [householdId], references: [id], onDelete: Cascade)

  userId String
  user   User @relation(fields: [userId], references: [id])

  entries GoalEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([householdId])
  @@map("savings_goals")
}

model GoalEntry {
  id     String  @id @default(cuid())
  amount Int
  note   String?

  goalId String
  goal   SavingsGoal @relation(fields: [goalId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([goalId])
  @@map("goal_entries")
}
```

- [ ] **Step 2: Add relations to Household and User models**

In the `Household` model, add after `tags Tag[]`:

```prisma
  savingsGoals SavingsGoal[]
```

In the `User` model, add after `recurringTransactions RecurringTransaction[]`:

```prisma
  savingsGoals SavingsGoal[]
```

- [ ] **Step 3: Run migration**

```bash
pnpm prisma migrate dev --name add-savings-goals
```

Expected: Migration created and applied successfully.

- [ ] **Step 4: Verify generated client**

```bash
pnpm prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add SavingsGoal and GoalEntry models to schema"
```

---

### Task 2: Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add GoalType and SavingsGoal types**

Add at the end of the file:

```typescript
export type GoalType = "SAVINGS" | "SPENDING";

export interface SavingsGoal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | Date | null;
  icon: string;
  color: string;
  user: { name: string | null };
}

export interface GoalEntry {
  id: string;
  amount: number;
  note: string | null;
  createdAt: string | Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add SavingsGoal and GoalEntry type definitions"
```

---

### Task 3: Validation Schemas

**Files:**
- Create: `src/lib/validations/goal.ts`
- Create: `src/lib/validations/__tests__/goal.test.ts`

- [ ] **Step 1: Write validation tests**

```typescript
import { describe, expect, it } from "vitest";
import { goalSchema, goalEntrySchema } from "../goal";

describe("goalSchema", () => {
  it("accepts valid savings goal", () => {
    const result = goalSchema.safeParse({
      name: "Trip to Europe",
      type: "SAVINGS",
      targetAmount: "5000.00",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid spending goal with optional fields", () => {
    const result = goalSchema.safeParse({
      name: "Reduce delivery",
      type: "SPENDING",
      targetAmount: "300.00",
      targetDate: "2026-12-31",
      icon: "utensils",
      color: "#f97316",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = goalSchema.safeParse({
      name: "",
      type: "SAVINGS",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero target amount", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "SAVINGS",
      targetAmount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "INVALID",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts missing optional fields", () => {
    const result = goalSchema.safeParse({
      name: "Goal",
      type: "SAVINGS",
      targetAmount: "100.00",
    });
    expect(result.success).toBe(true);
  });
});

describe("goalEntrySchema", () => {
  it("accepts valid deposit", () => {
    const result = goalEntrySchema.safeParse({
      amount: "500.00",
      type: "deposit",
      goalId: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid withdrawal with note", () => {
    const result = goalEntrySchema.safeParse({
      amount: "200.00",
      type: "withdrawal",
      goalId: "abc123",
      note: "Emergency",
    });
    expect(result.success).toBe(true);
  });

  it("rejects zero amount", () => {
    const result = goalEntrySchema.safeParse({
      amount: "0",
      type: "deposit",
      goalId: "abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing goalId", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "deposit",
      goalId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects note over 200 chars", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "deposit",
      goalId: "abc123",
      note: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid entry type", () => {
    const result = goalEntrySchema.safeParse({
      amount: "100.00",
      type: "transfer",
      goalId: "abc123",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/lib/validations/__tests__/goal.test.ts
```

Expected: FAIL — module `../goal` not found.

- [ ] **Step 3: Write validation schemas**

Create `src/lib/validations/goal.ts`:

```typescript
import { z } from "zod/v4";

export const goalSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: z.enum(["SAVINGS", "SPENDING"]),
  targetAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  targetDate: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const goalEntrySchema = z.object({
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
  type: z.enum(["deposit", "withdrawal"]),
  goalId: z.string().min(1, "Meta é obrigatória"),
  note: z.string().max(200, "Nota deve ter no máximo 200 caracteres").optional(),
});

export type GoalInput = z.infer<typeof goalSchema>;
export type GoalEntryInput = z.infer<typeof goalEntrySchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/lib/validations/__tests__/goal.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/goal.ts src/lib/validations/__tests__/goal.test.ts
git commit -m "feat: add Zod validation schemas for goals and entries"
```

---

## Chunk 2: Server Actions

### Task 4: Goal CRUD Server Actions

**Files:**
- Create: `src/lib/actions/goals.ts`

- [ ] **Step 1: Create goals server actions file with types and getGoals**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { goalSchema, goalEntrySchema } from "@/lib/validations/goal";
import { parseCurrency } from "@/lib/utils/money";
import type { GoalType } from "@prisma/client";

export interface GoalWithProgress {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  icon: string;
  color: string;
  percentage: number;
  createdAt: Date;
  userId: string;
  user: { name: string | null };
}

export interface GoalDetail extends GoalWithProgress {
  entries: {
    id: string;
    amount: number;
    note: string | null;
    createdAt: Date;
  }[];
}

export async function getGoals(type?: GoalType): Promise<GoalWithProgress[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const where = {
    householdId: session.user.householdId,
    ...(type && { type }),
  };

  const goals = await prisma.savingsGoal.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
  }));
}

export async function getGoalWithEntries(id: string): Promise<GoalDetail | null> {
  const session = await requireAuth();
  if (!session.user.householdId) return null;

  const goal = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
    include: {
      user: { select: { name: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!goal) return null;

  return {
    id: goal.id,
    name: goal.name,
    type: goal.type,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    targetDate: goal.targetDate,
    icon: goal.icon,
    color: goal.color,
    percentage: goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0,
    createdAt: goal.createdAt,
    userId: goal.userId,
    user: goal.user,
    entries: goal.entries,
  };
}

export async function getGoalsWithEntries(type?: GoalType): Promise<GoalDetail[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const goals = await prisma.savingsGoal.findMany({
    where: {
      householdId: session.user.householdId,
      ...(type && { type }),
    },
    include: {
      user: { select: { name: true } },
      entries: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return goals.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
    entries: g.entries,
  }));
}

export async function createGoal(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await prisma.savingsGoal.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type as GoalType,
        targetAmount: parseCurrency(parsed.data.targetAmount),
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        icon: parsed.data.icon ?? "piggy-bank",
        color: parsed.data.color ?? "#10b981",
        householdId: session.user.householdId,
        userId: session.user.id,
      },
    });
  } catch (error) {
    console.error("Failed to create goal:", error);
    return { error: "Erro ao criar meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function updateGoal(id: string, formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") || undefined,
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const existing = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
  });
  if (!existing) return { error: "Meta não encontrada" };
  if (existing.userId !== session.user.id) return { error: "Apenas o criador pode editar esta meta" };

  try {
    await prisma.savingsGoal.update({
      where: { id },
      data: {
        name: parsed.data.name,
        type: parsed.data.type as GoalType,
        targetAmount: parseCurrency(parsed.data.targetAmount),
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        icon: parsed.data.icon ?? "piggy-bank",
        color: parsed.data.color ?? "#10b981",
      },
    });
  } catch (error) {
    console.error("Failed to update goal:", error);
    return { error: "Erro ao atualizar meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function deleteGoal(id: string) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const existing = await prisma.savingsGoal.findFirst({
    where: { id, householdId: session.user.householdId },
  });
  if (!existing) return { error: "Meta não encontrada" };
  if (existing.userId !== session.user.id) return { error: "Apenas o criador pode excluir esta meta" };

  try {
    await prisma.savingsGoal.delete({ where: { id } });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return { error: "Erro ao excluir meta. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/goals.ts
git commit -m "feat: add goal CRUD server actions"
```

---

### Task 5: Goal Entry Actions + Dashboard Summary

**Files:**
- Modify: `src/lib/actions/goals.ts`

- [ ] **Step 1: Add entry actions and dashboard summary to goals.ts**

Append to the end of `src/lib/actions/goals.ts`:

```typescript
export async function addGoalEntry(formData: FormData) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  const parsed = goalEntrySchema.safeParse({
    amount: formData.get("amount"),
    type: formData.get("type"),
    goalId: formData.get("goalId"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const amountCents = parseCurrency(parsed.data.amount);
  const signedAmount = parsed.data.type === "withdrawal" ? -amountCents : amountCents;

  try {
    await prisma.$transaction(async (tx) => {
      const goal = await tx.savingsGoal.findFirst({
        where: { id: parsed.data.goalId, householdId: session.user.householdId },
      });

      if (!goal) throw new Error("Goal not found");

      if (signedAmount < 0 && goal.currentAmount + signedAmount < 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.goalEntry.create({
        data: {
          amount: signedAmount,
          note: parsed.data.note ?? null,
          goalId: goal.id,
        },
      });

      await tx.savingsGoal.update({
        where: { id: goal.id },
        data: { currentAmount: goal.currentAmount + signedAmount },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { error: "Saldo insuficiente para esta retirada" };
    }
    console.error("Failed to add goal entry:", error);
    return { error: "Erro ao registrar. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function deleteGoalEntry(entryId: string) {
  const session = await requireAuth();
  if (!session.user.householdId) return { error: "Grupo não encontrado" };

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await tx.goalEntry.findUnique({
        where: { id: entryId },
        include: { goal: { select: { id: true, householdId: true, currentAmount: true } } },
      });

      if (!entry || entry.goal.householdId !== session.user.householdId) {
        throw new Error("Entry not found");
      }

      const newAmount = entry.goal.currentAmount - entry.amount;

      await tx.goalEntry.delete({ where: { id: entryId } });
      await tx.savingsGoal.update({
        where: { id: entry.goalId },
        data: { currentAmount: Math.max(0, newAmount) },
      });
    });
  } catch (error) {
    console.error("Failed to delete goal entry:", error);
    return { error: "Erro ao remover registro. Tente novamente." };
  }

  revalidatePath("/goals");
  return { success: true };
}

export async function getGoalsSummary(): Promise<GoalWithProgress[]> {
  const session = await requireAuth();
  if (!session.user.householdId) return [];

  const allGoals = await prisma.savingsGoal.findMany({
    where: { householdId: session.user.householdId },
    include: { user: { select: { name: true } } },
  });

  const sorted = allGoals
    .map((g) => ({
      ...g,
      percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    }))
    .filter((g) => g.percentage < 100)
    .sort((a, b) => {
      if (a.targetDate && b.targetDate) return a.targetDate.getTime() - b.targetDate.getTime();
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
      return b.percentage - a.percentage;
    })
    .slice(0, 3);

  return sorted.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    targetDate: g.targetDate,
    icon: g.icon,
    color: g.color,
    percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
    createdAt: g.createdAt,
    userId: g.userId,
    user: g.user,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/goals.ts
git commit -m "feat: add goal entry actions and dashboard summary"
```

---

## Chunk 3: UI Components

### Task 6: Goal Form Component

**Files:**
- Create: `src/components/goal-form.tsx`

- [ ] **Step 1: Create goal form dialog**

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createGoal, updateGoal, type GoalWithProgress } from "@/lib/actions/goals";
import { toast } from "sonner";

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalWithProgress | null;
}

export function GoalForm({ open, onOpenChange, goal }: GoalFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!goal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    if (!name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const targetAmount = formData.get("targetAmount") as string;
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    const result = isEditing
      ? await updateGoal(goal.id, formData)
      : await createGoal(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEditing ? "Meta atualizada" : "Meta criada");
      onOpenChange(false);
    }
    setLoading(false);
  }

  const formatDateForInput = (date: string | Date | null): string => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ex: Viagem, Reserva de emergência..."
              defaultValue={goal?.name ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue={goal?.type ?? "SAVINGS"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAVINGS">Economia</SelectItem>
                <SelectItem value="SPENDING">Redução de Gasto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAmount">Valor alvo</Label>
            <CurrencyInput
              id="targetAmount"
              name="targetAmount"
              defaultValue={goal ? (goal.targetAmount / 100).toFixed(2) : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Select name="icon" defaultValue={goal?.icon ?? "piggy-bank"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piggy-bank">Cofrinho</SelectItem>
                  <SelectItem value="flag">Bandeira</SelectItem>
                  <SelectItem value="target">Alvo</SelectItem>
                  <SelectItem value="trophy">Troféu</SelectItem>
                  <SelectItem value="star">Estrela</SelectItem>
                  <SelectItem value="heart">Coração</SelectItem>
                  <SelectItem value="home">Casa</SelectItem>
                  <SelectItem value="car">Carro</SelectItem>
                  <SelectItem value="plane">Avião</SelectItem>
                  <SelectItem value="utensils">Comida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={goal?.color ?? "#10b981"}
                className="h-9 w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDate">Prazo (opcional)</Label>
            <Input
              id="targetDate"
              name="targetDate"
              type="date"
              defaultValue={goal ? formatDateForInput(goal.targetDate) : ""}
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

- [ ] **Step 2: Commit**

```bash
git add src/components/goal-form.tsx
git commit -m "feat: add goal form dialog component"
```

---

### Task 7: Goal Entry Form Component

**Files:**
- Create: `src/components/goal-entry-form.tsx`

- [ ] **Step 1: Create entry form component**

```typescript
"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addGoalEntry } from "@/lib/actions/goals";
import { toast } from "sonner";

interface GoalEntryFormProps {
  goalId: string;
  currentAmount: number;
}

export function GoalEntryForm({ goalId, currentAmount }: GoalEntryFormProps) {
  const [loading, setLoading] = useState(false);
  const [entryType, setEntryType] = useState("deposit");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("goalId", goalId);
    formData.set("type", entryType);

    const amount = formData.get("amount") as string;
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    const result = await addGoalEntry(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(entryType === "deposit" ? "Depósito registrado" : "Retirada registrada");
      form.reset();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor={`amount-${goalId}`} className="sr-only">Valor</Label>
          <CurrencyInput id={`amount-${goalId}`} name="amount" placeholder="Valor" />
        </div>
        <Select value={entryType} onValueChange={setEntryType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deposit">Depósito</SelectItem>
            <SelectItem value="withdrawal" disabled={currentAmount <= 0}>Retirada</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <Label htmlFor={`note-${goalId}`} className="sr-only">Nota</Label>
          <Input id={`note-${goalId}`} name="note" placeholder="Nota (opcional)" maxLength={200} />
        </div>
        <Button type="submit" size="sm" disabled={loading}>
          <Plus className="mr-1 h-4 w-4" />
          {loading ? "..." : "Adicionar"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/goal-entry-form.tsx
git commit -m "feat: add goal entry form component"
```

---

### Task 8: Goal List Component

**Files:**
- Create: `src/components/goal-list.tsx`

This is the main component for the `/goals` page. It renders filter tabs, goal cards with progress bars, collapsible entry detail, create/edit/delete dialogs.

- [ ] **Step 1: Create goal list component**

```typescript
"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, Flag, PiggyBank, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalForm } from "@/components/goal-form";
import { GoalEntryForm } from "@/components/goal-entry-form";
import { formatCurrency } from "@/lib/utils/money";
import { deleteGoal, deleteGoalEntry, type GoalDetail, type GoalWithProgress } from "@/lib/actions/goals";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { toast } from "sonner";
import type { GoalType } from "@/types";

interface GoalListProps {
  goals: GoalDetail[];
  currentUserId: string;
}

const TYPE_CONFIG = {
  SAVINGS: { label: "Economia", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: PiggyBank },
  SPENDING: { label: "Redução", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Flag },
} as const;

function progressColor(percentage: number) {
  if (percentage >= 100) return "bg-emerald-500";
  if (percentage >= 80) return "bg-amber-500";
  return "bg-blue-500";
}

function progressTextColor(percentage: number) {
  if (percentage >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (percentage >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-blue-600 dark:text-blue-400";
}

function formatTargetDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(date));
}

function paceStatus(goal: GoalWithProgress): { label: string; color: string } | null {
  if (!goal.targetDate || goal.percentage >= 100) return null;

  const now = new Date();
  const target = new Date(goal.targetDate);
  const created = new Date(goal.createdAt);

  if (target <= now) return { label: "Vencida", color: "text-rose-600 dark:text-rose-400" };

  const totalDays = Math.max(1, (target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = (elapsedDays / totalDays) * 100;

  if (goal.percentage >= expectedProgress) {
    return { label: "No ritmo", color: "text-emerald-600 dark:text-emerald-400" };
  }
  return { label: "Atrasada", color: "text-amber-600 dark:text-amber-400" };
}

export function GoalList({ goals, currentUserId }: GoalListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalWithProgress | null>(null);
  const [filter, setFilter] = useState<GoalType | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteGoal);

  const filtered = filter === "ALL" ? goals : goals.filter((g) => g.type === filter);

  async function handleDeleteEntry() {
    if (!deletingEntryId) return;
    const result = await deleteGoalEntry(deletingEntryId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Registro removido");
    }
    setDeletingEntryId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["ALL", "SAVINGS", "SPENDING"] as const).map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {t === "ALL" ? "Todas" : TYPE_CONFIG[t].label}
            </Button>
          ))}
        </div>
        <Button onClick={() => { setEditGoal(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((goal) => {
          const config = TYPE_CONFIG[goal.type];
          const TypeIcon = config.icon;
          const pace = paceStatus(goal);
          const isExpanded = expandedId === goal.id;
          const isOwner = goal.userId === currentUserId;

          return (
            <Collapsible key={goal.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? goal.id : null)}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{goal.name}</span>
                    </div>
                    <Badge variant="secondary" className={config.badgeClass}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground font-mono tabular-nums">{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor(goal.percentage)}`}
                        style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className={`text-xs font-medium font-mono tabular-nums ${progressTextColor(goal.percentage)}`}>
                        {goal.percentage}%
                      </span>
                      {goal.targetDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Até {formatTargetDate(goal.targetDate)}</span>
                          {pace && <span className={`ml-1 font-medium ${pace.color}`}>· {pace.label}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Ocultar" : "Detalhes"}
                      </Button>
                    </CollapsibleTrigger>
                    {isOwner && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditGoal(goal); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <CollapsibleContent>
                    <div className="mt-3 space-y-3">
                      <GoalEntryForm goalId={goal.id} currentAmount={goal.currentAmount} />

                      {goal.entries.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Histórico</p>
                          {goal.entries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono tabular-nums font-medium ${entry.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  {entry.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(entry.amount))}
                                </span>
                                {entry.note && <span className="text-muted-foreground">· {entry.note}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(entry.createdAt))}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeletingEntryId(entry.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <PiggyBank className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhuma meta criada</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Crie metas de economia ou redução de gastos e acompanhe seu progresso
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditGoal(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      )}

      <GoalForm open={formOpen} onOpenChange={setFormOpen} goal={editGoal} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir meta"
        description="Tem certeza que deseja excluir esta meta? Todo o histórico de depósitos será removido."
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
        title="Remover registro"
        description="Tem certeza que deseja remover este registro? O saldo da meta será recalculado."
        onConfirm={handleDeleteEntry}
        loading={false}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/goal-list.tsx
git commit -m "feat: add goal list component with cards, entries, and filters"
```

---

### Task 9: Goals Page

**Files:**
- Create: `src/app/(app)/goals/page.tsx`
- Create: `src/app/(app)/goals/loading.tsx`

- [ ] **Step 1: Create goals page**

```typescript
import { Flag } from "lucide-react";
import { getGoalsWithEntries } from "@/lib/actions/goals";
import { requireAuth } from "@/lib/auth-guard";
import { GoalList } from "@/components/goal-list";

export default async function GoalsPage() {
  const session = await requireAuth();
  const goals = await getGoalsWithEntries();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Metas</h2>
      </div>
      <GoalList goals={goals} currentUserId={session.user.id} />
    </div>
  );
}
```

- [ ] **Step 2: Create loading skeleton**

```typescript
export default function GoalsLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-muted animate-pulse" />
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-9 w-20 rounded bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded bg-muted animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-6 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 w-32 rounded bg-muted animate-pulse" />
              <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-2.5 rounded-full bg-muted animate-pulse" />
            <div className="flex justify-between">
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
              <div className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/goals/
git commit -m "feat: add goals page with loading skeleton"
```

---

### Task 10: Dashboard Goals Widget

**Files:**
- Create: `src/components/dashboard/goals-summary.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create goals summary widget**

```typescript
import Link from "next/link";
import { Flag, PiggyBank, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/money";
import type { GoalWithProgress } from "@/lib/actions/goals";

interface GoalsSummaryProps {
  goals: GoalWithProgress[];
}

function progressColor(percentage: number) {
  if (percentage >= 100) return "bg-emerald-500";
  if (percentage >= 80) return "bg-amber-500";
  return "bg-blue-500";
}

export function GoalsSummary({ goals }: GoalsSummaryProps) {
  if (goals.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Metas</h3>
        </div>
        <Link href="/goals" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          Ver todas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {goals.map((goal) => {
          const Icon = goal.type === "SAVINGS" ? PiggyBank : Flag;

          return (
            <div key={goal.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{goal.name}</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full transition-all ${progressColor(goal.percentage)}`}
                  style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-mono tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                <span className="text-muted-foreground font-mono tabular-nums">{goal.percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add widget to dashboard page**

In `src/app/(app)/dashboard/page.tsx`:

Add import:
```typescript
import { getGoalsSummary } from "@/lib/actions/goals";
import { GoalsSummary } from "@/components/dashboard/goals-summary";
```

Add `getGoalsSummary()` to the Promise.all call:
```typescript
const [summary, recentTransactions, insights, tagSummary, annualSummary, goalsSummary] = await Promise.all([
  getMonthlySummary(currentMonth),
  getRecentTransactions(5, currentMonth),
  getInsights(currentMonth),
  getTagSummary(currentMonth),
  getAnnualSummary(),
  getGoalsSummary(),
]);
```

Add `<GoalsSummary goals={goalsSummary} />` after `<TagSummary>` (before the closing `</>` of the non-empty branch):
```tsx
<TagSummary data={tagSummary} />
<GoalsSummary goals={goalsSummary} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/goals-summary.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add goals summary widget to dashboard"
```

---

### Task 11: Navigation Update

**Files:**
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Add Metas to sidebar nav items**

In `src/components/sidebar.tsx`:

Add `Flag` to the Lucide import:
```typescript
import { LayoutDashboard, ArrowLeftRight, Tag, Target, Repeat, Receipt, Flag, Settings, LogOut } from "lucide-react";
```

Add the nav item after the "Dívidas" entry (before "Configurações"):
```typescript
{ href: "/goals", label: "Metas", icon: Flag },
```

The final `navItems` array should be:
```typescript
export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/categories", label: "Categorias", icon: Tag },
  { href: "/budget", label: "Orçamento", icon: Target },
  { href: "/recurring", label: "Recorrências", icon: Repeat },
  { href: "/bills", label: "Dívidas", icon: Receipt },
  { href: "/goals", label: "Metas", icon: Flag },
  { href: "/settings", label: "Configurações", icon: Settings },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat: add Metas nav item to sidebar"
```

---

### Task 12: Seed Data

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Add sample goals and entries to seed**

Add the `GoalType` import:
```typescript
import { TransactionType, GoalType } from "@prisma/client";
```

Add after the existing seed logic (before `console.log` at the end of `main()`):

```typescript
  const savingsGoal = await prisma.savingsGoal.create({
    data: {
      name: "Trip to Europe",
      type: GoalType.SAVINGS,
      targetAmount: 1500000,
      currentAmount: 450000,
      targetDate: new Date("2026-12-31"),
      icon: "piggy-bank",
      color: "#10b981",
      householdId: household.id,
      userId: user.id,
    },
  });

  await prisma.goalEntry.createMany({
    data: [
      { amount: 200000, note: "First deposit", goalId: savingsGoal.id },
      { amount: 150000, note: "Bonus", goalId: savingsGoal.id },
      { amount: 100000, goalId: savingsGoal.id },
    ],
  });

  const spendingGoal = await prisma.savingsGoal.create({
    data: {
      name: "Reduce delivery",
      type: GoalType.SPENDING,
      targetAmount: 30000,
      currentAmount: 12000,
      icon: "utensils",
      color: "#f97316",
      householdId: household.id,
      userId: user.id,
    },
  });

  await prisma.goalEntry.createMany({
    data: [
      { amount: 5000, note: "Week 1", goalId: spendingGoal.id },
      { amount: 7000, note: "Week 2", goalId: spendingGoal.id },
    ],
  });

  console.log(`Created ${2} sample savings goals with entries`);
```

- [ ] **Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore: add sample savings goals to seed script"
```

---

## Chunk 4: Verification

### Task 13: Build and Manual Verification

- [ ] **Step 1: Run all tests**

```bash
pnpm vitest run
```

Expected: All tests pass including new goal validation tests.

- [ ] **Step 2: Run TypeScript type check**

```bash
pnpm tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual verification checklist**

Run `pnpm dev` and verify:

1. `/goals` page loads with empty state
2. "Nova Meta" opens form dialog
3. Create a SAVINGS goal with deadline → card appears with progress bar
4. Create a SPENDING goal without deadline → card appears
5. Filter tabs work (Todas / Economia / Redução)
6. Expand a card → entry form + history visible
7. Add deposit → saldo updates, entry appears in history
8. Add withdrawal → saldo decreases
9. Withdrawal blocked when amount > current balance
10. Delete entry → saldo recalculated
11. Edit goal → form pre-filled, changes saved
12. Delete goal → removed with confirmation
13. Dashboard shows goals summary widget (top 3)
14. Sidebar shows "Metas" between "Dívidas" and "Configurações"
15. Loading skeleton displays while page loads
