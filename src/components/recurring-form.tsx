"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createRecurringTransaction, updateRecurringTransaction } from "@/lib/actions/recurring";
import { validateTransactionFormData } from "@/lib/validations/shared";
import { toast } from "sonner";
import type { TransactionType } from "@/types";

interface Category {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
}

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  category: { id: string; name: string; color: string; type: TransactionType };
}

interface RecurringFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  recurring?: RecurringTransaction | null;
}

export function RecurringForm({ open, onOpenChange, categories, recurring }: RecurringFormProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(recurring?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(recurring?.category.id ?? "");
  const isEditing = !!recurring;

  useEffect(() => {
    if (open) {
      setType(recurring?.type ?? "EXPENSE");
      setCategoryId(recurring?.category.id ?? "");
    }
  }, [open, recurring?.type, recurring?.category.id]);

  const filteredCategories = categories.filter((c) => c.type === type);

  function handleTypeChange(newType: TransactionType) {
    setType(newType);
    const currentCat = categories.find((c) => c.id === categoryId);
    if (currentCat && currentCat.type !== newType) {
      setCategoryId("");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    formData.set("type", type);

    const validationError = validateTransactionFormData(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const dayOfMonth = parseInt(formData.get("dayOfMonth") as string, 10);
    if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
      toast.error("Dia deve ser entre 1 e 28");
      return;
    }

    setLoading(true);

    const result = isEditing
      ? await updateRecurringTransaction(recurring!.id, formData)
      : await createRecurringTransaction(formData);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success(isEditing ? "Recorrência atualizada" : "Recorrência criada");
      onOpenChange(false);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Nova"} Recorrência</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className="flex-1"
              onClick={() => handleTypeChange("EXPENSE")}
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              className="flex-1"
              onClick={() => handleTypeChange("INCOME")}
            >
              Receita
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" defaultValue={recurring?.description} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <CurrencyInput
              id="amount"
              name="amount"
              defaultValueCents={recurring?.amount ?? 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <Select name="categoryId" value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dayOfMonth">Dia do mês</Label>
            <Input
              id="dayOfMonth"
              name="dayOfMonth"
              type="number"
              min={1}
              max={28}
              defaultValue={recurring?.dayOfMonth ?? 1}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endMonth">Mês final (opcional)</Label>
            <Input
              id="endMonth"
              name="endMonth"
              type="month"
              defaultValue={recurring?.endMonth ?? ""}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
