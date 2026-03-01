# UX/Visual Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Gastei into a polished, mobile-friendly app with minimalist aesthetic and proper user feedback.

**Architecture:** Modify existing layout components for responsive behavior using shadcn/ui Sheet for mobile navigation. Add Sonner toasts for action feedback. Add Skeleton components for loading states. Polish visual with spacing, typography, and color adjustments.

**Tech Stack:** shadcn/ui (Sheet, Skeleton, Sonner), Tailwind CSS, Lucide icons

---

### Task 1: Install shadcn/ui components (Sonner, Skeleton)

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Install Sonner and Skeleton**

```bash
pnpm dlx shadcn@latest add sonner skeleton
```

**Step 2: Add Toaster to root layout**

Modify `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify dev server loads without errors**

```bash
curl -s -o /dev/null -w "%{http_code}" http://192.168.2.135:5000/login
```

Expected: `200`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: add sonner and skeleton shadcn/ui components"
```

---

### Task 2: Responsive sidebar with mobile Sheet drawer

**Files:**
- Modify: `src/components/sidebar.tsx`
- Create: `src/components/mobile-header.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Step 1: Extract nav items and create mobile header**

Create `src/components/mobile-header.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { navItems } from "@/components/sidebar";

export function MobileHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center border-b px-6">
            <h1 className="text-lg font-semibold">Gastei</h1>
          </div>
          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
        </SheetContent>
      </Sheet>

      <span className="text-lg font-semibold">Gastei</span>

      <ThemeToggle />
    </header>
  );
}
```

**Step 2: Export navItems from sidebar and hide on mobile**

Modify `src/components/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, Tag, Target, Users, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/categories", label: "Categorias", icon: Tag },
  { href: "/budget", label: "Orçamento", icon: Target },
  { href: "/household", label: "Household", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 flex-col border-r bg-card lg:flex">
      <div className="flex h-14 items-center border-b px-6">
        <h1 className="text-lg font-semibold">Gastei</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

**Step 3: Update app layout**

Modify `src/app/(app)/layout.tsx`:

```tsx
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileHeader } from "@/components/mobile-header";
import { requireAuth } from "@/lib/auth-guard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <MobileHeader />
          <Header />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
```

**Step 4: Hide desktop header on mobile**

Modify `src/components/header.tsx`:

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
    <header className="hidden h-14 items-center justify-end border-b px-6 lg:flex">
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{session?.user?.name}</span>
        </div>
      </div>
    </header>
  );
}
```

**Step 5: Test on desktop and mobile viewport**

Open http://192.168.2.135:5000/dashboard on desktop — sidebar should be visible.
Resize to < 1024px — sidebar hides, hamburger menu appears in top header.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add responsive layout with mobile sheet drawer"
```

---

### Task 3: Visual polish — typography, spacing, colors

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/transactions/page.tsx`
- Modify: `src/app/(app)/categories/page.tsx`
- Modify: `src/app/(app)/budget/page.tsx`
- Modify: `src/app/(app)/household/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/components/dashboard/summary-cards.tsx`
- Modify: `src/components/dashboard/recent-transactions.tsx`
- Modify: `src/components/dashboard/category-chart.tsx`
- Modify: `src/components/transactions-list.tsx`
- Modify: `src/components/categories-list.tsx`
- Modify: `src/components/budget-list.tsx`

**Step 1: Update page titles**

All pages: change `text-2xl font-bold` to `text-xl font-semibold` and `space-y-6` to `space-y-8`.

Dashboard page (`src/app/(app)/dashboard/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Dashboard</h2>
```

Transactions page (`src/app/(app)/transactions/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Transações</h2>
```

Categories page (`src/app/(app)/categories/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Categorias</h2>
```

Budget page (`src/app/(app)/budget/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Orçamento — {currentMonth}</h2>
```

Settings page (`src/app/(app)/settings/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Configurações</h2>
```

Household page (`src/app/(app)/household/page.tsx`):
```tsx
<div className="space-y-8">
  <h2 className="text-xl font-semibold">Household</h2>
```

**Step 2: Add font-mono to monetary values**

In `src/components/dashboard/summary-cards.tsx`, change all monetary value `<p>` tags:
```tsx
<p className="text-2xl font-semibold font-mono tabular-nums text-emerald-600">
```

Change `text-green-600` to `text-emerald-600` and `text-red-600` to `text-rose-600` across:
- `src/components/dashboard/summary-cards.tsx`
- `src/components/transactions-list.tsx`
- `src/components/dashboard/recent-transactions.tsx`
- `src/components/budget-list.tsx`

**Step 3: Commit**

```bash
git add -A
git commit -m "style: polish typography, spacing, and color palette"
```

---

### Task 4: Add Sonner toasts to all actions

**Files:**
- Modify: `src/components/transactions-list.tsx`
- Modify: `src/components/transaction-form.tsx`
- Modify: `src/components/categories-list.tsx`
- Modify: `src/components/category-form.tsx`
- Modify: `src/components/budget-list.tsx`
- Modify: `src/components/household-members.tsx`
- Modify: `src/components/settings-form.tsx`

**Step 1: Add toasts to transaction actions**

In `src/components/transaction-form.tsx`, add `import { toast } from "sonner"` and:
- On success: `toast.success("Transação salva")` then close dialog
- On error: `toast.error(result.error)`
- Remove the error state div (toasts replace it)

In `src/components/transactions-list.tsx`, add `import { toast } from "sonner"` and:
- On delete success: `toast.success("Transação excluída")`
- On delete error: `toast.error("Erro ao excluir")`

**Step 2: Add toasts to category actions**

In `src/components/category-form.tsx`, add toast on success/error.
In `src/components/categories-list.tsx`, replace `alert(result.error)` with `toast.error(result.error)`, add `toast.success("Categoria excluída")`.

**Step 3: Add toasts to budget actions**

In `src/components/budget-list.tsx`, add toasts for upsert and delete.

**Step 4: Add toasts to household and settings**

In `src/components/household-members.tsx` and `src/components/settings-form.tsx`, add appropriate toasts.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add sonner toasts for all CRUD actions"
```

---

### Task 5: Empty states with icons and CTAs

**Files:**
- Modify: `src/components/transactions-list.tsx`
- Modify: `src/components/categories-list.tsx`
- Modify: `src/components/budget-list.tsx`
- Modify: `src/components/dashboard/recent-transactions.tsx`
- Modify: `src/components/dashboard/category-chart.tsx`

**Step 1: Create empty state pattern**

For each empty state, replace plain `<p>` text with:

```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  <IconComponent className="h-12 w-12 text-muted-foreground/50" />
  <p className="mt-4 text-sm text-muted-foreground">Message text</p>
  <Button variant="outline" size="sm" className="mt-4" onClick={handleAction}>
    <Plus className="mr-2 h-4 w-4" />
    CTA text
  </Button>
</div>
```

Specific empty states:
- Transactions: `ArrowLeftRight` icon + "Nenhuma transação encontrada" + "Nova Transação" button
- Categories (if no categories at all): `Tag` icon + "Nenhuma categoria" + "Nova Categoria"
- Budget: `Target` icon + "Nenhum orçamento definido para este mês" + "Definir Orçamento"
- Dashboard recent transactions: `ArrowLeftRight` icon + "Nenhuma transação ainda" (no CTA, link to /transactions)
- Dashboard category chart: `PieChart` icon (from lucide) + "Sem despesas neste mês"

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add empty states with icons and CTAs"
```

---

### Task 6: Skeleton loading states

**Files:**
- Create: `src/app/(app)/dashboard/loading.tsx`
- Create: `src/app/(app)/transactions/loading.tsx`
- Create: `src/app/(app)/categories/loading.tsx`
- Create: `src/app/(app)/budget/loading.tsx`

**Step 1: Create dashboard loading skeleton**

Create `src/app/(app)/dashboard/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-32" />
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
```

**Step 2: Create transactions loading skeleton**

Create `src/app/(app)/transactions/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-9 w-40" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create categories loading skeleton**

Create `src/app/(app)/categories/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-9 w-40" />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create budget loading skeleton**

Create `src/app/(app)/budget/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function BudgetLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-9 w-44" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add skeleton loading states for all pages"
```
