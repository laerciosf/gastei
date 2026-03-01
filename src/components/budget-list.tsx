"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import { upsertBudget, deleteBudget, type BudgetWithSpent } from "@/lib/actions/budget";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface BudgetListProps {
  budgets: BudgetWithSpent[];
  categories: Category[];
  currentMonth: string;
}

export function BudgetList({ budgets, categories, currentMonth }: BudgetListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("month", currentMonth);

    const result = await upsertBudget(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setFormOpen(false);
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este orçamento?")) return;
    await deleteBudget(id);
  }

  return (
    <>
      <Button onClick={() => setFormOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Definir Orçamento
      </Button>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {budgets.map((budget) => {
          const percentage = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 0;
          const isOverBudget = budget.spent > budget.amount;

          return (
            <Card key={budget.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: budget.category.color }} />
                    <span className="font-medium">{budget.category.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-sm">
                    <span>{formatCurrency(budget.spent)}</span>
                    <span className="text-muted-foreground">{formatCurrency(budget.amount)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-secondary">
                    <div
                      className={`h-full rounded-full transition-all ${isOverBudget ? "bg-red-500" : "bg-primary"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {isOverBudget && (
                    <p className="mt-1 text-xs text-red-500">
                      Excedido em {formatCurrency(budget.spent - budget.amount)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">Nenhum orçamento definido para este mês</p>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Orçamento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
            )}
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
              <Label htmlFor="amount">Limite (R$)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
