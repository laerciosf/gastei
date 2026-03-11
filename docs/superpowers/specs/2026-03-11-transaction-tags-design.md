# Transaction Tags — Design Spec

## Overview

Add free-form tags to transactions for cross-category analysis (e.g., tag "viagem-sp" across food + transport + hotel transactions to see total trip cost).

## Requirements

- Tags belong to a household (shared across all members)
- Hybrid creation: autocomplete existing tags + create new inline
- Max 2 tags per transaction
- Tags have user-chosen color
- Tag names are unique per household (normalized: trim + lowercase)
- Tags appear in: transaction list, transaction filters, dashboard summary

## Data Model

### Tag

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| name | String | Unique per household (normalized) |
| color | String | Hex color, default #6b7280 |
| householdId | String | FK → Household |

Indexes: `@@unique([name, householdId])`, `@@index([householdId])`

### TransactionTag (join table)

| Field | Type | Notes |
|-------|------|-------|
| transactionId | String | FK → Transaction |
| tagId | String | FK → Tag |

PK: composite `[transactionId, tagId]`. Cascade delete on both sides.

### Relation additions

- `Household.tags: Tag[]`
- `Transaction.tags: TransactionTag[]`
- Max 2 tags per transaction enforced via Zod validation in server actions

## Server Actions

### Tags CRUD (`src/lib/actions/tags.ts`)

- `getTags()` — all household tags, ordered by name
- `createTag(formData)` — name (trim+lowercase) + color. Returns existing tag if name matches (upsert semantic)
- `updateTag(id, formData)` — rename or change color
- `deleteTag(id)` — removes tag and all transaction links (cascade)

### Transaction changes (`src/lib/actions/transactions.ts`)

- `createTransaction` / `updateTransaction` accept `tagIds` (0-2 ids) via formData
- Create: transaction + TransactionTag records in a single `prisma.$transaction`
- Update: delete old links, recreate new ones
- `getTransactions` includes `tags: { include: { tag: true } }`, accepts `tagId` filter param

### Dashboard (`src/lib/actions/dashboard.ts`)

- `getTagSummary(month?)` — groups transactions by tag for the month, returns `{ tagId, tagName, tagColor, totalIncome, totalExpense }[]`

## Validation

### `src/lib/validations/tag.ts`

- `tagSchema`: name (1-30 chars, trim), color (hex regex `^#[0-9a-fA-F]{6}$`)

### `src/lib/validations/transaction.ts`

- Add `tagIds: z.array(z.string()).max(2).optional()`

## UI Components

### TagPicker (`src/components/tag-picker.tsx`)

- Inline in transaction form, below date field
- Uses existing `Command` (cmdk) component for autocomplete
- Text input filters existing household tags as user types
- Selected tags shown as colored badges with X button to remove
- If typed text doesn't match existing tag, shows "Create [name]" option → mini popover for color selection
- Input disabled when 2 tags are selected (placeholder: "Maximo de 2 tags")

### Transaction list (`src/components/transactions-list.tsx`)

- Small colored badges next to existing "Recorrente" badge
- Tag color as background at ~20% opacity, full color text

### Transaction filters (`src/app/(app)/transactions/page.tsx`)

- New `tagId` search param
- Select/combobox alongside existing filters (month, category, type, search)

### Tag summary card (`src/components/dashboard/tag-summary.tsx`)

- Card listing tags used in the month with total income/expense per tag
- Only rendered if there are tagged transactions in the month
- Positioned after the category chart

### Tag management (Settings)

- New "Tags" section in `src/components/settings-form.tsx`
- Lists household tags with edit (name/color) and delete actions
- No dedicated page

## Files Impacted

| Layer | File | Change |
|-------|------|--------|
| Schema | `prisma/schema.prisma` | +Tag, +TransactionTag, relations on Household/Transaction |
| Seed | `prisma/seed.ts` | Optional default tags |
| Validation | `src/lib/validations/tag.ts` | New Zod schema |
| Validation | `src/lib/validations/transaction.ts` | +tagIds field |
| Actions | `src/lib/actions/tags.ts` | New — CRUD |
| Actions | `src/lib/actions/transactions.ts` | +tagIds in create/update, include tags in get, +tagId filter |
| Actions | `src/lib/actions/dashboard.ts` | +getTagSummary |
| Types | `src/types/index.ts` | +Tag, +TransactionTag interfaces |
| Component | `src/components/tag-picker.tsx` | New — autocomplete + inline create |
| Component | `src/components/transaction-form.tsx` | +TagPicker |
| Component | `src/components/transactions-list.tsx` | +tag badges, +tagId filter |
| Component | `src/components/dashboard/tag-summary.tsx` | New — tag summary card |
| Component | `src/components/settings-form.tsx` | +tag management section |
| Page | `src/app/(app)/transactions/page.tsx` | +tagId searchParam |
| Page | `src/app/(app)/dashboard/page.tsx` | +TagSummary card |

## Out of Scope

- Dedicated tag management page
- Tags on recurring transactions
- Tags in insights system
- Export/import functionality
