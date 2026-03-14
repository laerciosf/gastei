# Split Expenses — Design Spec

## Overview

Add expense splitting between household members with balance tracking and settlement transactions. Supports equal splits, custom amounts, and configurable default ratios per household.

## Data Model

### New Tables

**Split** — Links a transaction to its division among members.

| Field         | Type     | Notes                          |
|---------------|----------|--------------------------------|
| id            | cuid     | PK                             |
| transactionId | String   | FK → Transaction, unique (1:1) |
| createdAt     | DateTime | default now()                  |

Relations: `shares: SplitShare[]`, `transaction: Transaction`

**SplitShare** — One member's portion of a split.

| Field   | Type   | Notes                            |
|---------|--------|----------------------------------|
| id      | cuid   | PK                               |
| splitId | String | FK → Split                       |
| userId  | String | FK → User                        |
| amount  | Int    | Value in cents this member owes  |

Constraint: `@@unique([splitId, userId])`
Invariant: Sum of all `SplitShare.amount` for a split must equal `Transaction.amount`.

### Altered Models

**Household** — New optional field:
- `defaultSplitRatio: Json?` — e.g. `{ "userId1": 60, "userId2": 40 }`. Null means equal split.

**Transaction** — New optional fields for settlements:
- `settlementFromId: String?` — FK → User (who paid the settlement)
- `settlementToId: String?` — FK → User (who received the settlement)
- `split: Split?` — reverse relation

**TransactionType** — New enum value:
- `SETTLEMENT` — filtered out of summary/budget/insights queries.

**User** — New relations:
- `splitShares: SplitShare[]`
- `settlementsFrom: Transaction[] @relation("settlementFrom")`
- `settlementsTo: Transaction[] @relation("settlementTo")`

## Balance Calculation

Between members A and B:

```
A owes B = sum of SplitShare.amount for A in transactions paid by B
B owes A = sum of SplitShare.amount for B in transactions paid by A
Settlements A→B = sum of SETTLEMENT transactions from A to B
Settlements B→A = sum of SETTLEMENT transactions from B to A

Net balance of A with B = (A owes B) - (B owes A) - (Settlements A→B) + (Settlements B→A)
```

Positive = A owes B. Negative = B owes A.

Calculated on-demand via server action (not materialized). Trivial for households of 2-4 members.

## Interaction Flows

### Creating a Split (in transaction form)

1. User creates/edits transaction normally
2. Toggle "Dividir despesa" expands split section
3. Members pre-selected with household default ratio (or equal if not configured)
4. User can adjust amount/percentage per member or remove members
5. Validation: share amounts must sum to transaction total
6. Save creates Transaction + Split + SplitShares in a DB transaction

### Creating a Split (after the fact)

1. Transaction without split shows "Dividir" button in the list
2. Opens modal with same split UI
3. Saves Split + SplitShares linked to existing transaction

### Settling Debt

1. On `/splits` page or dashboard card, user sees "Voce deve R$150 a Fulano"
2. "Acertar" button opens modal with pre-filled amount (adjustable for partial settlement)
3. Confirming creates a Transaction with `type: SETTLEMENT`, `settlementFromId`, `settlementToId`
4. Settlement appears in transaction history and splits page

### Configuring Default Ratio

1. On `/household` page, section "Proporcao padrao de divisao"
2. Sliders or inputs per member, summing to 100%
3. Saves to `Household.defaultSplitRatio`

## Server Actions

### New (`src/lib/actions/splits.ts`)

- `getBalance()` — calculates net balance between all household member pairs
- `getSplits(month?)` — lists transactions with splits, filterable by month
- `getSettlements(month?)` — lists settlement transactions between members
- `createSplit(transactionId, shares[])` — creates split on existing transaction
- `createSettlement(toUserId, amount)` — creates settlement transaction
- `deleteSplit(splitId)` — removes split from a transaction

### Modified

- `createTransaction` / `updateTransaction` — accept optional `shares[]` to create split inline
- `getMonthlySummary` / `getInsights` / `getBudgets` — filter out `SETTLEMENT` from calculations

No changes needed for `deleteTransaction` — Prisma cascade handles split cleanup.

## Validation

### `src/lib/validations/split.ts`

- `splitShareSchema`: `{ userId: string, amount: string | number }`
- `splitSchema`: array of `splitShareSchema`, validated that sum matches transaction total
- `settlementSchema`: `{ toUserId: string, amount: string }`

## Components

### New

- `split-section.tsx` — split UI inside transaction form (toggle + member list + value inputs)
- `split-button.tsx` — "Dividir" button on transaction list, opens modal with split-section
- `split-balance-card.tsx` — dashboard card showing balance between members
- `splits-page.tsx` — content for `/splits` route (summary + split list + settlements)
- `settlement-dialog.tsx` — modal to register a settlement

### New Route

- `src/app/(app)/splits/page.tsx` + `loading.tsx`
- "Divisoes" item added to sidebar navigation

## Indexes

- `SplitShare.userId` — for balance queries
- `Transaction.settlementFromId` — for settlement lookups
- `Transaction.settlementToId` — for settlement lookups

## Edge Cases

- **Member removed from household**: their shares remain for historical accuracy. Balance with removed member is frozen (no new splits possible).
- **Transaction deleted**: cascade deletes Split and SplitShares. Balance recalculates automatically.
- **Split deleted**: only removes the split, transaction remains intact.
- **Settlement exceeds balance**: validation prevents settling more than owed.
- **Partial settlement**: allowed — balance updates proportionally.
- **Recurring transaction with split**: split is per-occurrence (each paid occurrence can have its own split). The split section appears after marking as paid.
- **SETTLEMENT in existing queries**: filtered out everywhere via `type: { in: ["INCOME", "EXPENSE"] }` or `type: { not: "SETTLEMENT" }`.
