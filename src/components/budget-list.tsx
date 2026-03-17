"use client";

import { useState } from "react";
import { Plus, Trash2, Target, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/utils/money";
import { upsertBudget, deleteBudget, type BudgetWithSpent } from "@/lib/actions/budget";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { toast } from "sonner";
import type { Category } from "@/types";

interface BudgetListProps {
  budgets: BudgetWithSpent[];
  categories: Pick<Category, "id" | "name" | "type">[];
  currentMonth: string;
}

export function BudgetList({ budgets, categories, currentMonth }: BudgetListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteBudget);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalPercentage = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    formData.set("month", currentMonth);

    const categoryId = formData.get("categoryId") as string;
    if (!categoryId) {
      toast.error("Selecione uma categoria");
      return;
    }

    const amount = formData.get("amount") as string;
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);

    const result = await upsertBudget(formData);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Orçamento salvo");
      setFormOpen(false);
    }
    setLoading(false);
  }

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Definir Orçamento
      </Button>

      {budgets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Total orçado</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-300">
              {formatCurrency(totalBudgeted)}
            </p>
          </div>
          <div className={`rounded-lg border p-4 ${
            totalPercentage >= 100
              ? "border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20"
              : totalPercentage >= 80
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          }`}>
            <p className={`text-xs font-medium ${
              totalPercentage >= 100
                ? "text-rose-600 dark:text-rose-400"
                : totalPercentage >= 80
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            }`}>Total gasto</p>
            <p className={`mt-1 text-2xl font-bold font-mono tabular-nums ${
              totalPercentage >= 100
                ? "text-rose-700 dark:text-rose-300"
                : totalPercentage >= 80
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-300"
            }`}>
              {formatCurrency(totalSpent)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-medium text-muted-foreground">Uso geral</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className={`text-2xl font-bold font-mono tabular-nums ${
                totalPercentage >= 100
                  ? "text-rose-600 dark:text-rose-400"
                  : totalPercentage >= 80
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
              }`}>
                {totalPercentage}%
              </p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-secondary">
              <div
                className={`h-full rounded-full transition-all ${
                  totalPercentage >= 100
                    ? "bg-rose-500"
                    : totalPercentage >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(totalPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {budgets.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Categorias</h3>
          </div>
          <Badge variant="secondary" className="font-mono tabular-nums">
            {budgets.length} {budgets.length === 1 ? "orçamento" : "orçamentos"}
          </Badge>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const percentage = budget.amount > 0 ? Math.round((budget.spent / budget.amount) * 100) : 0;
          const isOverBudget = budget.spent > budget.amount;
          const isNearLimit = percentage >= 80 && !isOverBudget;

          return (
            <Card key={budget.id} className="transition-colors hover:bg-accent/50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: budget.category.color }} />
                    <span className="font-medium">{budget.category.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(budget.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-mono tabular-nums">{formatCurrency(budget.spent)}</span>
                    <span className="text-muted-foreground font-mono tabular-nums">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isOverBudget
                          ? "bg-rose-500"
                          : isNearLimit
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className={`text-xs font-medium font-mono tabular-nums ${
                      isOverBudget
                        ? "text-rose-600 dark:text-rose-400"
                        : isNearLimit
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {percentage}% usado
                    </span>
                    {isOverBudget && (
                      <span className="text-xs text-rose-500 font-mono tabular-nums">
                        +{formatCurrency(budget.spent - budget.amount)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
            <Target className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhum orçamento definido</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Defina limites para suas categorias de despesa e acompanhe seus gastos
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Definir Orçamento
          </Button>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Orçamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria</Label>
              <Select name="categoryId">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Limite</Label>
              <CurrencyInput id="amount" name="amount" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Remover orçamento"
        description="Tem certeza que deseja remover este orçamento?"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
