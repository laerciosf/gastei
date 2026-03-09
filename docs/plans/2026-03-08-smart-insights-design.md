# Smart Insights — Design

## Concept

Automatic insight system that analyzes current month transactions and compares them against previous month and 3-month average. Only displays relevant insights (variation > 20%).

## Data & Logic

Two comparisons per category with transactions:
- `deltaMonth` — % variation of current month vs. previous month
- `deltaTrend` — % variation of current month vs. last 3 months average

Relevance filter: only generates insight if `|delta| > 20%` in at least one comparison.

Ordering: by highest `|deltaMonth|` descending (most expressive variations first).

Edge cases:
- Category with no spending in previous month → "New expense" insight if amount > 0
- Category with spending last month but zero now → "Zeroed spending in X" insight
- Less than 2 months of history → only shows month-over-month, no 3-month trend

## Data Model

No new table — insights are calculated on-the-fly via query aggregating `Transaction` by category/month. A server action `getInsights(month)` returns:

```ts
type Insight = {
  categoryId: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  currentAmount: number      // cents
  previousAmount: number     // cents
  averageAmount: number      // cents (3-month average)
  deltaMonth: number         // percentage
  deltaTrend: number         // percentage
  type: 'increase' | 'decrease' | 'new' | 'gone'
}
```

## UI

### Dashboard (compact cards)
- "Insights" section below summary cards, above category chart
- Compact cards: category icon, name, current amount, badge with `deltaMonth` (green if decreased, red if increased for expenses — inverted for income)
- Only shows insights passing the threshold, no fixed limit
- "Ver todos" link → `/insights`

### Page `/insights`
- Full insight list with both comparisons (previous month + 3-month trend)
- Expanded card: category name, current amount, previous amount, 3-month average, both deltas with visual indicators
- Month selector at top (reuse pattern from other pages)
- Empty state if no relevant insights

## Stack
- Server action `getInsights()` with aggregated Prisma query (groupBy)
- Components: `InsightCard`, `InsightsList`, `DashboardInsights`
- Reuses `formatCurrency()`, existing category icons, summary cards visual pattern
