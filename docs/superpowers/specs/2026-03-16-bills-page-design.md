# Bills Page — Monthly Debts by Category

## Overview

New page at `/bills` showing transactions with unpaid `SplitEntry` records, grouped by category, with month picker navigation. Users can toggle split entries as paid/unpaid using the existing button pattern.

## Data Flow

1. Server page receives `?month=YYYY-MM` search param
2. Server action `getBills(month)` queries transactions for that month with split entries (including paid ones for the category totals)
3. Client component groups by category and renders cards
4. Toggle reuses existing `toggleSplitPaid` from `splits.ts`, revalidating `/bills`

## Query

```sql
SELECT t.*, c.*, se.*
FROM Transaction t
LEFT JOIN Category c ON t.categoryId = c.id
JOIN SplitEntry se ON se.transactionId = t.id
WHERE t.householdId = :householdId
  AND t.date >= :monthStart
  AND t.date < :monthEnd
ORDER BY c.name, t.date
```

## Components

### Page (`src/app/(app)/bills/page.tsx`)
- Server component
- Fetches bills via `getBills(month)`
- Renders header with MonthPicker + BillsList

### BillsList (`src/components/bills-list.tsx`)
- Client component
- Props: `bills: BillTransaction[]`
- Groups transactions by category
- Renders summary cards (total pending vs paid)
- Per category: Card with split entries list
- Each entry: person name, transaction description, amount, Pagar/Pago button
- Paid entries: strikethrough + muted text

### Server Action (`src/lib/actions/bills.ts`)
- `getBills(month: string)` — returns transactions with splits for the month
- Reuses `toggleSplitPaid` from splits.ts (add revalidatePath("/bills"))

## UI Layout

```
Header: "Dívidas" icon=Receipt + MonthPicker

Summary: Pendente R$ X | Pago R$ Y

[Card: Category Name (paid/total)]
  transaction.description — entry.personName  R$ amount  [Pagar/Pago]
  transaction.description — entry.personName  R$ amount  [Pagar/Pago]

[Card: Category Name (paid/total)]
  ...
```

## Navigation
- Sidebar entry: "Dívidas" with Receipt icon, route `/bills`
- Between "Recorrências" and "Configurações"
