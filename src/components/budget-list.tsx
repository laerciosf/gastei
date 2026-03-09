"use client";

import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
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
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(budget.id)}>
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
                      className={`h-full rounded-full transition-all ${isOverBudget ? "bg-rose-500" : "bg-primary"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {isOverBudget && (
                    <p className="mt-1 text-xs text-rose-500">
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
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhum orçamento definido para este mês</p>
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
