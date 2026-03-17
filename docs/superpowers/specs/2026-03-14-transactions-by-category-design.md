# Transactions Grouped by Category View

## Overview

Add a toggle to the transactions page that switches between the current flat list (by date) and a grouped-by-category accordion view. Each category becomes a collapsible section showing its transactions with full functionality.

## Components

### 1. View Toggle
- Two icon buttons in the `TransactionsList` header: `List` (flat) and `LayoutGrid` (by category)
- Local state, no persistence
- Located next to existing filters

### 2. Collapsible UI Component
- New shadcn/ui component based on `@radix-ui/react-collapsible`
- Animated expand/collapse with smooth transition

### 3. CategoryGroup Component
- **Header**: category icon (colored dot), category name, transaction count, total amount, chevron indicator
- **Body** (collapsible): transaction rows using the same rendering as the current `TransactionsList`
- All existing functionality preserved: edit, delete, split, tags

### Layout

```
[● icon] Alimentação (3)                    R$ 473,00  ▼
├── Supermercado Extra       02/03  [tags]   R$ 285,00  [actions]
├── Jantar japonês           08/03  [tags]   R$ 189,00  [actions]
└── Mercado feira orgânica   07/03  [tags]   R$ 125,00  [actions]

[● icon] Moradia (1)                        R$ 220,00  ▶
```

### Ordering
- Categories: by total amount (highest first)
- Transactions within each group: by date (most recent first)

### Data
- No backend changes required
- Grouping done client-side with `reduce` over existing transactions
- All existing filters (search, type, tags) apply before grouping
- Category filter active → only that category group shown
- Pagination disabled in category view (shows all transactions for the month)

## Files to Create/Modify

- **Create**: `src/components/ui/collapsible.tsx` (shadcn component)
- **Modify**: `src/components/transactions-list.tsx` (add toggle + category view)
