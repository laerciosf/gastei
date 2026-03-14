# Split Expenses Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expense splitting between household members with balance tracking and settlement transactions.

**Architecture:** New `Split` + `SplitShare` tables linked to `Transaction`. Settlements are `Transaction` records with `type: SETTLEMENT`. Balance calculated on-demand via join queries. Split UI integrated into transaction form + dedicated `/splits` page.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, Zod v4, shadcn/ui, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-13-split-expenses-design.md`

---

## Chunk 1: Foundation

### Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add SETTLEMENT to TransactionType enum**

```prisma
enum TransactionType {
  INCOME
  EXPENSE
  SETTLEMENT
}
```

- [ ] **Step 2: Add Split and SplitShare models**

After the `RecurringOccurrence` model, add:

```prisma
model Split {
  id            String       @id @default(cuid())
  createdAt     DateTime     @default(now())

  transactionId String       @unique
  transaction   Transaction  @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  shares        SplitShare[]

  @@map("splits")
}

model SplitShare {
  id      String @id @default(cuid())
  amount  Int

  splitId String
  split   Split  @relation(fields: [splitId], references: [id], onDelete: Cascade)

  userId  String
  user    User   @relation(fields: [userId], references: [id])

  @@unique([splitId, userId])
  @@index([userId])
  @@map("split_shares")
}
```

- [ ] **Step 3: Add settlement fields to Transaction**

In the `Transaction` model, make `categoryId` optional and add settlement fields.

**IMPORTANT:** Making `categoryId` optional means `category` relation becomes `Category?`. Update `TransactionWithRelations` in `transactions.ts` to use `category: Category | null`. All UI code rendering `tx.category.name` must handle null (use `tx.category?.name ?? "Sem categoria"`).

```prisma
model Transaction {
  // ... existing fields ...
  categoryId       String?
  category         Category?         @relation(fields: [categoryId], references: [id])
  // ... existing relations ...
  split            Split?
  settlementFromId String?
  settlementFrom   User?             @relation("settlementFrom", fields: [settlementFromId], references: [id])
  settlementToId   String?
  settlementTo     User?             @relation("settlementTo", fields: [settlementToId], references: [id])

  @@index([settlementFromId])
  @@index([settlementToId])
}
```

- [ ] **Step 4: Add defaultSplitRatio to Household**

```prisma
model Household {
  // ... existing fields ...
  defaultSplitRatio Json?
}
```

- [ ] **Step 5: Add new relations to User**

```prisma
model User {
  // ... existing relations ...
  splitShares      SplitShare[]
  settlementsFrom  Transaction[]     @relation("settlementFrom")
  settlementsTo    Transaction[]     @relation("settlementTo")
}
```

- [ ] **Step 6: Generate migration and Prisma client**

Run:
```bash
npx prisma migrate dev --name add-split-expenses
npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat: add split expenses schema (Split, SplitShare, SETTLEMENT type)"
```

---

### Task 2: TypeScript types and validation schemas

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/lib/validations/split.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Update `TransactionType` and add split-related types:

```typescript
export type TransactionType = "INCOME" | "EXPENSE" | "SETTLEMENT";

// ... existing types unchanged ...

export interface SplitShare {
  userId: string;
  userName: string | null;
  amount: number;
}

export interface SplitBalance {
  memberId: string;
  memberName: string | null;
  amount: number; // positive = you owe them, negative = they owe you
}

export interface SplitTransaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  payer: { id: string; name: string | null };
  category: { name: string; color: string };
  shares: SplitShare[];
}

export interface Settlement {
  id: string;
  description: string;
  amount: number;
  date: Date;
  from: { id: string; name: string | null };
  to: { id: string; name: string | null };
}
```

- [ ] **Step 2: Create validation schemas at `src/lib/validations/split.ts`**

```typescript
import { z } from "zod/v4";

export const splitShareSchema = z.object({
  userId: z.string().min(1, "Membro obrigatório"),
  amount: z.coerce.number().int().min(1, "Valor deve ser maior que zero"),
});

export const splitSchema = z.array(splitShareSchema).min(2, "Mínimo 2 membros para dividir");

export const settlementSchema = z.object({
  toUserId: z.string().min(1, "Membro obrigatório"),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, "Valor deve ser maior que zero"),
});

export const defaultSplitRatioSchema = z
  .record(z.coerce.number().int().min(0))
  .refine((obj) => {
    const values = Object.values(obj);
    return values.length >= 2 && values.reduce((a, b) => a + b, 0) === 100;
  }, "Proporções devem somar 100%");

export type SplitShareInput = z.infer<typeof splitShareSchema>;
export type SettlementInput = z.infer<typeof settlementSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/validations/split.ts
git commit -m "feat: add split expense types and validation schemas"
```

---

## Chunk 2: Backend — Server Actions

### Task 3: Split server actions (CRUD)

**Files:**
- Create: `src/lib/actions/splits.ts`

- [ ] **Step 1: Create `src/lib/actions/splits.ts` with getBalance**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { splitSchema, settlementSchema } from "@/lib/validations/split";
import { parseCurrency } from "@/lib/utils/money";
import { safeMonth } from "@/lib/utils/date";
import type { SplitBalance, SplitTransaction, Settlement } from "@/types";

function revalidateSplitPaths() {
  revalidatePath("/splits");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
}

export async function getBalance(): Promise<SplitBalance[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: { members: { select: { id: true, name: true } } },
  });
  if (!household || household.members.length < 2) return [];

  const currentUserId = session.user.id;

  // Get all split shares for this household's transactions
  const shares = await prisma.splitShare.findMany({
    where: {
      split: { transaction: { householdId } },
    },
    include: {
      split: {
        include: {
          transaction: { select: { userId: true, amount: true } },
        },
      },
    },
  });

  // Get all settlements for this household
  const settlements = await prisma.transaction.findMany({
    where: { householdId, type: "SETTLEMENT" },
    select: { settlementFromId: true, settlementToId: true, amount: true },
  });

  // Calculate net balance between current user and each other member
  const balanceMap = new Map<string, number>();

  for (const share of shares) {
    const payerId = share.split.transaction.userId;
    const debtorId = share.userId;

    // Skip payer's own share (they don't owe themselves)
    if (payerId === debtorId) continue;

    // Only track balances involving the current user
    if (payerId === currentUserId) {
      // Current user paid, other member owes them
      balanceMap.set(debtorId, (balanceMap.get(debtorId) ?? 0) - share.amount);
    } else if (debtorId === currentUserId) {
      // Current user owes the payer
      balanceMap.set(payerId, (balanceMap.get(payerId) ?? 0) + share.amount);
    }
  }

  // Apply settlements
  for (const s of settlements) {
    if (!s.settlementFromId || !s.settlementToId) continue;

    if (s.settlementFromId === currentUserId) {
      // Current user paid a settlement TO someone (reduces what they owe)
      balanceMap.set(s.settlementToId, (balanceMap.get(s.settlementToId) ?? 0) - s.amount);
    } else if (s.settlementToId === currentUserId) {
      // Someone paid a settlement TO current user (reduces what they owe current user)
      balanceMap.set(s.settlementFromId, (balanceMap.get(s.settlementFromId) ?? 0) + s.amount);
    }
  }

  const memberMap = new Map(household.members.map((m) => [m.id, m.name]));

  return [...balanceMap.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([memberId, amount]) => ({
      memberId,
      memberName: memberMap.get(memberId) ?? null,
      amount,
    }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}
```

- [ ] **Step 2: Add getSplits action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function getSplits(month?: string): Promise<SplitTransaction[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const targetMonth = safeMonth(month);
  const [year, mon] = targetMonth.split("-").map(Number);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "EXPENSE",
      date: {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      },
      split: { isNot: null },
    },
    include: {
      category: { select: { name: true, color: true } },
      user: { select: { id: true, name: true } },
      split: {
        include: {
          shares: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    payer: { id: tx.user.id, name: tx.user.name },
    category: { name: tx.category?.name ?? "Sem categoria", color: tx.category?.color ?? "#6b7280" },
    shares: tx.split!.shares.map((s) => ({
      userId: s.userId,
      userName: s.user.name,
      amount: s.amount,
    })),
  }));
}
```

- [ ] **Step 3: Add getSettlements action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function getSettlements(month?: string): Promise<Settlement[]> {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) return [];

  const targetMonth = safeMonth(month);
  const [year, mon] = targetMonth.split("-").map(Number);

  const transactions = await prisma.transaction.findMany({
    where: {
      householdId,
      type: "SETTLEMENT",
      date: {
        gte: new Date(Date.UTC(year, mon - 1, 1)),
        lt: new Date(Date.UTC(year, mon, 1)),
      },
    },
    include: {
      settlementFrom: { select: { id: true, name: true } },
      settlementTo: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return transactions.map((tx) => ({
    id: tx.id,
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    from: { id: tx.settlementFrom!.id, name: tx.settlementFrom!.name },
    to: { id: tx.settlementTo!.id, name: tx.settlementTo!.name },
  }));
}
```

- [ ] **Step 4: Add createSplit action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function createSplit(transactionId: string, shares: { userId: string; amount: number }[]) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = splitSchema.safeParse(shares);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, householdId, type: "EXPENSE" },
    include: { split: true },
  });

  if (!transaction) {
    return { error: "Transação não encontrada" };
  }

  if (transaction.split) {
    return { error: "Transação já possui divisão" };
  }

  const shareSum = parsed.data.reduce((sum, s) => sum + s.amount, 0);
  if (shareSum !== transaction.amount) {
    return { error: "Soma das divisões deve ser igual ao valor da transação" };
  }

  // Verify all users belong to the household
  const memberIds = parsed.data.map((s) => s.userId);
  const validMembers = await prisma.user.count({
    where: { id: { in: memberIds }, householdId },
  });
  if (validMembers !== memberIds.length) {
    return { error: "Membro não encontrado no grupo" };
  }

  // Payer must be included
  if (!memberIds.includes(transaction.userId)) {
    return { error: "O pagador deve estar incluído na divisão" };
  }

  try {
    await prisma.split.create({
      data: {
        transactionId,
        shares: {
          createMany: {
            data: parsed.data.map((s) => ({ userId: s.userId, amount: s.amount })),
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to create split:", error);
    return { error: "Erro ao criar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
```

- [ ] **Step 5: Add updateSplit action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function updateSplit(splitId: string, shares: { userId: string; amount: number }[]) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = splitSchema.safeParse(shares);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const split = await prisma.split.findFirst({
    where: { id: splitId, transaction: { householdId } },
    include: { transaction: { select: { amount: true, userId: true } } },
  });

  if (!split) {
    return { error: "Divisão não encontrada" };
  }

  const shareSum = parsed.data.reduce((sum, s) => sum + s.amount, 0);
  if (shareSum !== split.transaction.amount) {
    return { error: "Soma das divisões deve ser igual ao valor da transação" };
  }

  const memberIds = parsed.data.map((s) => s.userId);
  const validMembers = await prisma.user.count({
    where: { id: { in: memberIds }, householdId },
  });
  if (validMembers !== memberIds.length) {
    return { error: "Membro não encontrado no grupo" };
  }

  if (!memberIds.includes(split.transaction.userId)) {
    return { error: "O pagador deve estar incluído na divisão" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.splitShare.deleteMany({ where: { splitId } });
      await tx.splitShare.createMany({
        data: parsed.data.map((s) => ({ splitId, userId: s.userId, amount: s.amount })),
      });
    });
  } catch (error) {
    console.error("Failed to update split:", error);
    return { error: "Erro ao atualizar divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
```

- [ ] **Step 6: Add deleteSplit action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function deleteSplit(splitId: string) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const split = await prisma.split.findFirst({
    where: { id: splitId, transaction: { householdId } },
  });

  if (!split) {
    return { error: "Divisão não encontrada" };
  }

  try {
    await prisma.split.delete({ where: { id: splitId } });
  } catch (error) {
    console.error("Failed to delete split:", error);
    return { error: "Erro ao remover divisão. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
```

- [ ] **Step 7: Add createSettlement action**

Append to `src/lib/actions/splits.ts`:

```typescript
export async function createSettlement(formData: FormData) {
  const session = await requireAuth();
  const householdId = session.user.householdId;
  if (!householdId) {
    return { error: "Grupo não encontrado" };
  }

  const parsed = settlementSchema.safeParse({
    toUserId: formData.get("toUserId"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const toUser = await prisma.user.findFirst({
    where: { id: parsed.data.toUserId, householdId },
  });

  if (!toUser) {
    return { error: "Membro não encontrado no grupo" };
  }

  if (toUser.id === session.user.id) {
    return { error: "Não é possível acertar consigo mesmo" };
  }

  // Validate settlement amount against current balance
  const balances = await getBalance();
  const balanceWithTarget = balances.find((b) => b.memberId === toUser.id);
  const amountCents = parseCurrency(parsed.data.amount);

  if (!balanceWithTarget || balanceWithTarget.amount <= 0) {
    return { error: "Não há saldo devedor com este membro" };
  }

  if (amountCents > balanceWithTarget.amount) {
    return { error: "Valor excede o saldo devedor" };
  }

  try {
    await prisma.transaction.create({
      data: {
        description: `Acerto com ${toUser.name ?? toUser.email}`,
        amount: amountCents,
        type: "SETTLEMENT",
        date: new Date(),
        categoryId: null,
        userId: session.user.id,
        householdId,
        settlementFromId: session.user.id,
        settlementToId: toUser.id,
      },
    });
  } catch (error) {
    console.error("Failed to create settlement:", error);
    return { error: "Erro ao registrar acerto. Tente novamente." };
  }

  revalidateSplitPaths();
  return { success: true };
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/splits.ts
git commit -m "feat: add split expense server actions"
```

---

### Task 4: Filter SETTLEMENT from existing queries

**Files:**
- Modify: `src/lib/actions/dashboard.ts`
- Modify: `src/lib/actions/transactions.ts`
- Modify: `src/lib/actions/insights.ts`

- [ ] **Step 1: Filter SETTLEMENT in `dashboard.ts`**

In `getMonthlySummary`, add `type: { not: "SETTLEMENT" as const }` to `dateFilter`:

```typescript
const dateFilter = {
  householdId: session.user.householdId,
  date: { gte: startDate, lt: endDate },
  type: { not: "SETTLEMENT" as const },
};
```

In `getRecentTransactions`, add to `where`:

```typescript
const where: Record<string, unknown> = {
  householdId: session.user.householdId,
  type: { not: "SETTLEMENT" },
};
```

In `getTagSummary`, add to the `where.transaction` filter:

```typescript
where: {
  transaction: {
    householdId: session.user.householdId,
    date: { gte: startDate, lt: endDate },
    type: { not: "SETTLEMENT" },
  },
},
```

- [ ] **Step 2: Filter SETTLEMENT in `transactions.ts`**

In `getTransactions`, when no explicit type filter is set, exclude SETTLEMENT. After the existing type filter block (line 61-63):

```typescript
if (params.type) {
  where.type = params.type;
} else {
  where.type = { not: "SETTLEMENT" };
}
```

- [ ] **Step 3: Filter SETTLEMENT in `insights.ts`**

In `getInsights`, add `type: { not: "SETTLEMENT" as const }` to all three `groupBy` queries. For each of the three queries (`currentTotals`, `previousTotals`, `trendTotals`), add the filter to the `where` clause:

```typescript
// currentTotals
where: { householdId, date: currentRange, type: { not: "SETTLEMENT" as const } },
// previousTotals
where: { householdId, date: previousRange, type: { not: "SETTLEMENT" as const } },
// trendTotals
where: { householdId, date: { gte: trendStart, lt: trendEnd }, type: { not: "SETTLEMENT" as const } },
```

**Note:** `getBudgets` in `budget.ts` already filters `type: "EXPENSE"` — SETTLEMENT is excluded. `getAnnualSummary` in `annual.ts` uses raw SQL with `type = 'EXPENSE'` — also safe. No changes needed for these files.

- [ ] **Step 4: Add `/splits` revalidation to existing mutation actions**

In `src/lib/actions/transactions.ts`:
- `createTransaction`: add `revalidatePath("/splits");` after existing revalidations
- `updateTransaction`: add `revalidatePath("/splits");` after existing revalidations
- `deleteTransaction`: add `revalidatePath("/splits");` after existing revalidations

In `src/lib/actions/recurring.ts`:
- `toggleOccurrencePaid`: already revalidates `/recurring`, `/transactions`, `/dashboard` — add `revalidatePath("/splits");`

- [ ] **Step 5: Handle split deletion when transaction amount changes in `updateTransaction`**

In `src/lib/actions/transactions.ts`, in `updateTransaction`, after fetching `existing`, also include the split:

```typescript
const existing = await prisma.transaction.findFirst({
  where: { id, householdId },
  include: { split: true },
});
```

Then inside the `prisma.$transaction` block, before the update, delete the split if the amount changed:

```typescript
const newAmount = parseCurrency(parsed.data.amount);

await tx.transaction.update({
  where: { id },
  data: {
    description: parsed.data.description,
    amount: newAmount,
    type: parsed.data.type,
    date: new Date(parsed.data.date + "T00:00:00Z"),
    categoryId: parsed.data.categoryId,
  },
});

// Delete split if amount changed (user must re-split)
if (existing.split && newAmount !== existing.amount) {
  await tx.split.delete({ where: { id: existing.split.id } });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/dashboard.ts src/lib/actions/transactions.ts src/lib/actions/insights.ts src/lib/actions/recurring.ts
git commit -m "feat: filter SETTLEMENT from financial queries and add split revalidation"
```

---

## Chunk 3: UI — Split Section & Transaction Integration

### Task 5: Split section component

**Files:**
- Create: `src/components/split-section.tsx`

- [ ] **Step 1: Create split section component**

This component renders inside the transaction form when type is EXPENSE. It shows a toggle, and when expanded, a list of household members with amount inputs.

Props:
- `members: { id: string; name: string | null }[]` — household members
- `totalAmount: number` — transaction amount in cents (for validation)
- `defaultRatio: Record<string, number> | null` — household default ratio
- `shares: { userId: string; amount: number }[] | null` — existing shares (for editing)
- `onChange: (shares: { userId: string; amount: number }[] | null) => void` — callback

Behavior:
- Toggle "Dividir despesa" shows/hides the member list
- When enabled, pre-fill with `defaultRatio` (or equal split) based on `totalAmount`
- Each member has an amount input (currency format)
- Show validation error if sum != totalAmount
- When disabled, call `onChange(null)` to clear shares
- Re-calculate shares when `totalAmount` changes (proportionally based on current ratio)

The component must be a controlled client component using `useState` for the enabled state and individual amounts.

- [ ] **Step 2: Commit**

```bash
git add src/components/split-section.tsx
git commit -m "feat: add split section component"
```

---

### Task 6: Integrate split into transaction form

**Files:**
- Modify: `src/components/transaction-form.tsx`
- Modify: `src/components/transactions-list.tsx`
- Modify: `src/app/(app)/transactions/page.tsx`

- [ ] **Step 1: Update TransactionForm to accept members and split props**

Add to `TransactionFormProps`:
```typescript
members?: { id: string; name: string | null }[];
defaultSplitRatio?: Record<string, number> | null;
```

Add state for shares:
```typescript
const [shares, setShares] = useState<{ userId: string; amount: number }[] | null>(null);
```

After the TagPicker, conditionally render SplitSection when `type === "EXPENSE"` and `members` is provided with 2+ members:
```tsx
{type === "EXPENSE" && members && members.length >= 2 && (
  <SplitSection
    members={members}
    totalAmount={/* current amount in cents */}
    defaultRatio={defaultSplitRatio ?? null}
    shares={shares}
    onChange={setShares}
  />
)}
```

In `handleSubmit`, include shares in formData:
```typescript
if (shares) {
  formData.set("shares", JSON.stringify(shares));
}
```

- [ ] **Step 2: Update createTransaction to handle shares**

In `src/lib/actions/transactions.ts`, in `createTransaction`, parse optional shares from FormData:

```typescript
let shares: { userId: string; amount: number }[] | null = null;
try {
  const rawShares = formData.get("shares");
  if (rawShares) shares = JSON.parse(rawShares as string);
} catch {
  // ignore malformed shares
}
```

Import `splitSchema` at the top of the file (NOT inside the transaction callback):

```typescript
import { splitSchema } from "@/lib/validations/split";
```

Validate shares BEFORE entering the DB transaction:

```typescript
let validatedShares: { userId: string; amount: number }[] | null = null;
if (shares && shares.length >= 2 && parsed.data.type === "EXPENSE") {
  const parsedShares = splitSchema.safeParse(shares);
  if (parsedShares.success) {
    const shareSum = parsedShares.data.reduce((sum, s) => sum + s.amount, 0);
    if (shareSum === parseCurrency(parsed.data.amount)) {
      validatedShares = parsedShares.data;
    }
  }
}
```

Then inside the `prisma.$transaction` block, after creating the transaction and tags:

```typescript
if (validatedShares) {
  await tx.split.create({
    data: {
      transactionId: transaction.id,
      shares: {
        createMany: {
          data: validatedShares.map((s) => ({ userId: s.userId, amount: s.amount })),
        },
      },
    },
  });
}
```

- [ ] **Step 3: Pass members to TransactionsList and TransactionForm**

In `src/app/(app)/transactions/page.tsx`, fetch household members and pass to the list:

```typescript
import { getHousehold } from "@/lib/actions/household";

// In the page function, add to Promise.all:
const [result, categories, tags, household] = await Promise.all([
  getTransactions({ month: currentMonth, categoryId, type: typeFilter, search, tagId, page }),
  getCategories(),
  getTags(),
  getHousehold(),
]);

const members = household?.members ?? [];
const defaultSplitRatio = household?.defaultSplitRatio as Record<string, number> | null;
```

Pass `members` and `defaultSplitRatio` as props to `TransactionsList`, which then passes them to `TransactionForm`.

In `TransactionsListProps`, add:
```typescript
members: { id: string; name: string | null }[];
defaultSplitRatio: Record<string, number> | null;
```

- [ ] **Step 4: Add split button and badge to transactions list**

In `src/components/transactions-list.tsx`, for each transaction row:
- If `tx.type === "EXPENSE"` and has no split: show a small "Dividir" button (Split icon from lucide)
- If `tx.type === "EXPENSE"` and has a split: show a split badge/icon

This requires `getTransactions` to include split data. In `src/lib/actions/transactions.ts`, add to the `include`:

```typescript
split: {
  select: {
    id: true,
    shares: {
      select: { userId: true, amount: true, user: { select: { name: true } } },
    },
  },
},
```

Add `split` to the `Transaction` interface in `transactions-list.tsx`.

For the split button: open a `Dialog` containing `SplitSection` + a submit button that calls `createSplit(tx.id, shares)` server action.

For the split badge: show a `Scale` icon. On click, open a `Dialog` with `SplitSection` pre-filled with existing shares. Two actions:
- "Salvar" calls `updateSplit(tx.split.id, shares)`
- "Remover divisão" calls `deleteSplit(tx.split.id)` with confirmation

**UI guard for SETTLEMENT transactions:** SETTLEMENT transactions should never appear in the regular list (they're filtered by the `where` clause). But as a safety net, skip edit/delete buttons for any transaction with `type === "SETTLEMENT"`. Settlements are only manageable from the `/splits` page.

- [ ] **Step 5: Commit**

```bash
git add src/components/transaction-form.tsx src/components/transactions-list.tsx src/app/\(app\)/transactions/page.tsx src/lib/actions/transactions.ts
git commit -m "feat: integrate split section into transaction form and list"
```

---

## Chunk 4: UI — Splits Page, Dashboard Card, Settlement

### Task 7: Settlement dialog component

**Files:**
- Create: `src/components/settlement-dialog.tsx`

- [ ] **Step 1: Create settlement dialog**

Props:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `memberId: string`
- `memberName: string | null`
- `maxAmount: number` — maximum settable amount (current balance)
- `direction: "you-owe" | "they-owe"` — determines the flow

Dialog shows:
- Title: "Acertar com {name}"
- Description: "Você deve R${amount}" or "{name} te deve R${amount}"
- CurrencyInput pre-filled with `maxAmount`, editable
- Confirm button calls `createSettlement` server action with FormData
- Uses `useTransition` for loading state (following `use-delete-action.ts` pattern)

- [ ] **Step 2: Commit**

```bash
git add src/components/settlement-dialog.tsx
git commit -m "feat: add settlement dialog component"
```

---

### Task 8: Split balance card for dashboard

**Files:**
- Create: `src/components/dashboard/split-balance-card.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Create balance card component**

Props:
- `balances: SplitBalance[]`

Shows a card with title "Divisões" containing:
- For each balance entry with amount > 0: "Você deve R${amount} a {name}" in rose
- For each balance entry with amount < 0: "{name} te deve R${amount}" in emerald
- Link to `/splits` for details
- If no balances, don't render the card

Follow the pattern of `src/components/dashboard/tag-summary.tsx`.

- [ ] **Step 2: Add balance card to dashboard page**

In `src/app/(app)/dashboard/page.tsx`:
- Import `getBalance` from splits actions
- Add to `Promise.all`
- Render `SplitBalanceCard` in the dashboard layout (after TagSummary)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/split-balance-card.tsx src/app/\(app\)/dashboard/page.tsx
git commit -m "feat: add split balance card to dashboard"
```

---

### Task 9: Splits page

**Files:**
- Create: `src/app/(app)/splits/page.tsx`
- Create: `src/app/(app)/splits/loading.tsx`
- Create: `src/components/splits-list.tsx`
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Create splits page**

`src/app/(app)/splits/page.tsx` — Server component:

```typescript
import { getBalance, getSplits, getSettlements } from "@/lib/actions/splits";
import { getHousehold } from "@/lib/actions/household";
import { SplitsList } from "@/components/splits-list";
import { MonthPicker } from "@/components/month-picker";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function SplitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  const currentMonth = params.month && monthRegex.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);

  const [balances, splits, settlements, household] = await Promise.all([
    getBalance(),
    getSplits(currentMonth),
    getSettlements(currentMonth),
    getHousehold(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Divisões</h2>
        <MonthPicker currentMonth={currentMonth} />
      </div>
      <SplitsList
        balances={balances}
        splits={splits}
        settlements={settlements}
        members={household?.members ?? []}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create loading skeleton**

`src/app/(app)/splits/loading.tsx` — Follow existing loading patterns (e.g., `src/app/(app)/recurring/loading.tsx`). Show skeleton cards.

- [ ] **Step 3: Create SplitsList component**

`src/components/splits-list.tsx` — Client component with three sections:

**Balance summary (top):**
- Card per member with balance: "Você deve R$X a Y" (rose) or "Y te deve R$X" (emerald)
- "Acertar" button opens `SettlementDialog`
- If all balances are zero: "Todas as contas estão acertadas"

**Split transactions (middle):**
- List of transactions with splits for the selected month
- Each row shows: description, total, payer, per-member breakdown
- "Editar divisão" and "Remover divisão" actions per row

**Settlements (bottom):**
- List of settlement transactions for the selected month
- Each row shows: date, "A acertou R$X com B", delete button

- [ ] **Step 4: Add sidebar navigation item**

In `src/components/sidebar.tsx`:
- Import `Scale` (or `Split`) from lucide-react
- Add to `navItems` array after "Recorrências":

```typescript
{ href: "/splits", label: "Divisões", icon: Scale },
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/splits/ src/components/splits-list.tsx src/components/sidebar.tsx
git commit -m "feat: add splits page with balance summary and settlement flow"
```

---

## Chunk 5: Household Default Ratio

### Task 10: Default split ratio configuration

**Files:**
- Modify: `src/app/(app)/household/page.tsx`
- Create: `src/components/split-ratio-config.tsx`
- Modify: `src/lib/actions/household.ts`

- [ ] **Step 1: Add updateDefaultSplitRatio server action**

In `src/lib/actions/household.ts`, add:

```typescript
import { defaultSplitRatioSchema } from "@/lib/validations/split";

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

    // Verify all userIds are current members
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
      data: { defaultSplitRatio: ratio },
    });
  } catch (error) {
    console.error("Failed to update split ratio:", error);
    return { error: "Erro ao salvar proporção. Tente novamente." };
  }

  revalidatePath("/household");
  return { success: true };
}
```

- [ ] **Step 2: Add resetDefaultSplitRatio to removeMember**

In `src/lib/actions/household.ts`, in `removeMember`, inside the `prisma.$transaction` block, after creating the new household, reset the ratio:

```typescript
await tx.household.update({
  where: { id: session.user.householdId! },
  data: { defaultSplitRatio: null },
});
```

Also in `acceptInvite`, inside the `prisma.$transaction` block, after updating the user's householdId, reset the ratio on the target household:

```typescript
await tx.household.update({
  where: { id: newHouseholdId },
  data: { defaultSplitRatio: null },
});
```

This ensures the ratio resets when a new member joins (spec requirement).

- [ ] **Step 3: Create SplitRatioConfig component**

`src/components/split-ratio-config.tsx` — Client component:

Props:
- `members: { id: string; name: string | null }[]`
- `currentRatio: Record<string, number> | null`

Shows:
- Section title: "Proporção padrão de divisão"
- Description: "Define como as despesas são divididas por padrão"
- Input per member with percentage value
- Validation: values must sum to 100%
- "Salvar" button calls `updateDefaultSplitRatio`
- "Resetar para igual" button sets all to equal and saves
- Uses `useTransition` for loading

- [ ] **Step 4: Integrate into household page**

In `src/app/(app)/household/page.tsx`, add `SplitRatioConfig` after the members section. Pass household members and `defaultSplitRatio`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/household.ts src/components/split-ratio-config.tsx src/app/\(app\)/household/page.tsx
git commit -m "feat: add default split ratio configuration to household"
```

---

## Chunk 6: Final Integration & Verification

### Task 11: End-to-end verification

- [ ] **Step 1: Run Prisma migration and generate**

```bash
npx prisma migrate dev
npx prisma generate
```

Verify: no migration errors.

- [ ] **Step 2: Build the project**

```bash
npm run build
```

Verify: no TypeScript errors, no build failures.

- [ ] **Step 3: Manual testing checklist**

1. Create an EXPENSE transaction with split (50/50 between 2 members)
2. Verify transaction appears in `/transactions` with split badge
3. Verify split appears in `/splits` page
4. Verify dashboard balance card shows correct amount
5. Create a split after the fact (via "Dividir" button)
6. Edit an existing split
7. Delete a split
8. Change transaction amount → verify split is deleted
9. Create a settlement → verify balance updates
10. Verify SETTLEMENT doesn't appear in monthly summary, insights, budget, annual chart, tag summary
11. Verify INCOME transactions cannot be split
12. Configure default split ratio on household page
13. Create new split → verify default ratio is pre-filled
14. Remove a household member → verify ratio resets to null

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete split expenses feature"
```
