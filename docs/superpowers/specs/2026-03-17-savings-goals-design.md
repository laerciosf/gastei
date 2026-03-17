# Savings Goals (Metas de Economia)

## Overview

Two types of savings goals with manual progress tracking, no category binding, and optional deadlines.

- **Accumulation (SAVINGS):** Save toward a target amount (e.g., "Trip - R$ 5,000")
- **Spending Reduction (SPENDING):** Track progress toward a spending reduction target (e.g., "Reduce delivery to R$ 300")

Both types share the same data model and mechanics — manual deposits/withdrawals with a target amount. The difference is semantic (UI labels, icons, colors).

## Data Model

### SavingsGoal

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| name | String | Goal name (e.g., "Viagem Europa") |
| type | GoalType enum | `SAVINGS` or `SPENDING` |
| targetAmount | Int | Target amount in cents |
| currentAmount | Int (default 0) | Current progress in cents (denormalized) |
| targetDate | DateTime? | Optional deadline |
| icon | String (default "piggy-bank") | Lucide icon name |
| color | String (default "#10b981") | Hex color |
| householdId | String | FK to Household |
| userId | String | FK to User (creator) |
| createdAt | DateTime | Auto-generated |
| updatedAt | DateTime | Auto-updated |

Relations: `household`, `user`, `entries` (GoalEntry[])

### GoalEntry

| Field | Type | Description |
|-------|------|-------------|
| id | String (cuid) | Primary key |
| amount | Int | Amount in cents (positive = deposit, negative = withdrawal) |
| note | String? | Optional note (max 200 chars) |
| goalId | String | FK to SavingsGoal |
| createdAt | DateTime | Auto-generated |

Relation: `goal` (SavingsGoal, onDelete: Cascade)

### GoalType Enum

```
SAVINGS   — Accumulation goal
SPENDING  — Spending reduction goal
```

### Design Decisions

- **Denormalized `currentAmount`:** Updated via Prisma transaction when entries are added/removed. Avoids N+1 queries on dashboard/list views.
- **Cascade delete:** Deleting a goal removes all its entries automatically.
- **No category binding:** Goals are independent — user defines name and target freely.
- **`currentAmount` never goes negative:** Withdrawal blocked if it would exceed current balance.

## UI Design

### Page: `/goals`

**Header:** Target icon + "Metas" title + "Nova Meta" button (opens dialog).

**Filter tabs:** `Todas | Economia | Redução de Gasto`

**Cards grid** (responsive: 1 col mobile → 2 md → 3 lg):

Each card shows:
- Goal name + type badge (green "Economia" / orange "Redução")
- Linear progress bar with percentage
- Current vs target: `R$ 2.500 / R$ 5.000`
- Deadline if set: `Até dez/2026` with pace indicator (on track / behind)
- Custom icon and color
- Edit and delete buttons

**Card interaction:** Clicking a card expands it (collapsible) or opens a dialog showing:
- Entry history (chronological list: date, amount, note)
- Inline form to add deposit/withdrawal (amount + optional note)
- Delete button per entry

### Dashboard Widget

Section "Metas" showing top 3 goals (closest to target or nearest deadline):
- Compact cards: name + mini progress bar + percentage
- "Ver todas" link → `/goals`

### Visual Patterns

- **Progress bar colors:** Same pattern as budget — green (<80%), amber (80-99%), emerald (100%+)
- **Type badges:** Green for SAVINGS, orange for SPENDING
- **Layout:** Follows existing page patterns (icon + title header, max-w-5xl, space-y-8)
- **Interactions:** shadcn/ui Dialog for create/edit, Collapsible for entry history, toast notifications

## Server Actions

File: `src/lib/actions/goals.ts`

| Action | Description |
|--------|-------------|
| `getGoals(type?)` | List goals for household, with progress percentage. Optional type filter. |
| `getGoalWithEntries(id)` | Single goal with paginated entry history. |
| `getGoalsSummary()` | Top 3 goals for dashboard widget (closest to completion or nearest deadline). |
| `createGoal(formData)` | Create new goal. |
| `updateGoal(formData)` | Edit goal (name, target, deadline, icon, color). |
| `deleteGoal(id)` | Delete goal + cascade entries. |
| `addGoalEntry(formData)` | Add entry + update `currentAmount` in Prisma transaction. |
| `deleteGoalEntry(id)` | Remove entry + recalculate `currentAmount` from remaining entries. |

All actions use `requireAuth()` and filter by `householdId`.

## Validation Schemas

File: `src/lib/validations/goal.ts`

### goalSchema

```
name: string, min 1 char
type: enum SAVINGS | SPENDING
targetAmount: string → parsed > 0
targetDate: string? → valid future date or empty
icon: string? → defaults to "piggy-bank"
color: string? → defaults to "#10b981"
```

### goalEntrySchema

```
amount: string → parsed > 0
type: enum "deposit" | "withdrawal"
note: string? → max 200 chars
goalId: string, min 1 char
```

The `type` field in entry schema determines sign: deposit = positive, withdrawal = negative amount stored.

## Components

| Component | File | Description |
|-----------|------|-------------|
| GoalForm | `src/components/goal-form.tsx` | Dialog for create/edit goal |
| GoalList | `src/components/goal-list.tsx` | Grid of goal cards with type filter tabs |
| GoalDetail | `src/components/goal-detail.tsx` | Collapsible/dialog with entries + add entry form |
| GoalEntryForm | `src/components/goal-entry-form.tsx` | Inline form for deposit/withdrawal |
| GoalsSummary | `src/components/dashboard/goals-summary.tsx` | Dashboard widget with top 3 goals |

## Navigation

Add "Metas" to sidebar between "Dívidas" and "Configurações":
- Icon: `Target` (lucide)
- Route: `/goals`
- Label: "Metas"

## Business Rules

1. `currentAmount` is always >= 0 (withdrawals blocked if insufficient balance)
2. `targetAmount` must be > 0
3. `targetDate` if set must be in the future (at creation time)
4. Goals belong to a household — all members can see them
5. Only the creator can edit/delete a goal
6. Progress percentage: `Math.min(100, Math.round((currentAmount / targetAmount) * 100))`
7. Pace calculation (if deadline set): `expectedProgress = elapsed / totalDuration * 100` — compare with actual to determine "on track" vs "behind"
