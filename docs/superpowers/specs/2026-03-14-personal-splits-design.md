# Personal Splits (Phase 1)

## Overview

Replace the current household-linked split system (`Split` + `SplitShare` tied to user IDs) with a simpler personal split model. Splits become a personal tracking tool — the user types a person's name (free text), assigns an amount, and marks it as paid when they receive the money. No shared state between users.

## Data Model

### New: `SplitEntry`

```prisma
model SplitEntry {
  id            String    @id @default(cuid())
  personName    String
  amount        Int
  paid          Boolean   @default(false)
  paidAt        DateTime?
  transactionId String
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)

  @@index([transactionId])
  @@map("split_entries")
}
```

### Removed models

- `Split` — replaced by direct `SplitEntry` → `Transaction` relation
- `SplitShare` — replaced by `SplitEntry.personName` (free text instead of userId)

### Transaction model changes

- Remove `split` relation (one-to-one with `Split`)
- Add `splitEntries SplitEntry[]` relation
- Remove `settlementFromId`, `settlementToId`, `settlementFrom`, `settlementTo` fields
- Remove `SETTLEMENT` from `TransactionType` enum

## Totals Calculation

- **Expense**: always the full transaction amount
- **Implicit income**: sum of `SplitEntry.amount` where `paid = true` for EXPENSE transactions in the month
- **Month balance**: `income + implicit_income - expenses`

No separate transaction is created when a split is marked as paid. The calculation happens in `getTransactions` by summing paid split entries.

### Implementation in `getTransactions`

Add a new return field `paidSplitTotal` alongside `totalIncome` and `totalExpense`:

```ts
const paidSplitTotal = transactions
  .filter(tx => tx.type === "EXPENSE")
  .flatMap(tx => tx.splitEntries ?? [])
  .filter(entry => entry.paid)
  .reduce((sum, entry) => sum + entry.amount, 0);
```

Balance = `totalIncome + paidSplitTotal - totalExpense`

## UI: Transaction Row

Transactions with split entries show a "Dividida" badge (existing pattern). Clicking it or expanding shows a collapsible section inside the row:

```
Aluguel                    05 mar 2026         R$ 2.500,00
  ┌─────────────────────────────────────────────────────┐
  │ Alice    R$ 1.250,00  [✓ Pago]                      │
  │ Carlos   R$ 1.250,00  [  Pagar  ]                   │
  └─────────────────────────────────────────────────────┘
```

- "Pago" button toggles `paid` status (optimistic UI with server action)
- Badge changes appearance when all entries are paid vs. some pending

## UI: Split Dialog (Create/Edit)

Adapts the existing split dialog:

- **Person name**: text input (free text)
- **Amount**: CurrencyInput (existing component)
- **"+" button**: adds another person row
- **"×" button**: removes a person row (min 1 entry)
- **Validation**: sum of parts must be <= transaction amount (partial splits allowed)
- **No member dropdown** — fully decoupled from household members

## Pages & Components Affected

### Modified
- `prisma/schema.prisma` — new model, remove old models, remove settlement fields
- `src/components/transactions-list.tsx` — adapt split badge, add collapsible split details, adapt split dialog to free text
- `src/lib/actions/splits.ts` — rewrite for new model (createSplit, updateSplit, deleteSplit, toggleSplitPaid)
- `src/lib/actions/transactions.ts` — include splitEntries in query, add paidSplitTotal to response
- `src/types/index.ts` — update types

### Removed
- `src/app/(app)/splits/` — entire page (balance view no longer applies)
- `src/lib/actions/splits.ts` — `getBalance` function
- Settlement-related code in transactions-list.tsx
- Navigation link to splits page

### Not changed (Phase 2)
- Household model and pages remain
- Categories/tags/budgets stay on household
- User visibility (still sees all household transactions — Phase 2 changes this)

## Migration Strategy

1. Create `split_entries` table
2. Migrate existing data: for each `SplitShare`, create a `SplitEntry` with `personName` = the user's name from the `User` table
3. Drop `split_shares` table
4. Drop `splits` table
5. Remove settlement fields from `transactions` table
6. Remove `SETTLEMENT` from enum
