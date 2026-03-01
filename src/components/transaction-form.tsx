"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionData {
  id: string;
  description: string;
  amount: number;
  type: string;
  categoryId: string;
  date: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  transaction?: TransactionData | null;
}

export function TransactionForm({ open, onOpenChange, categories, transaction }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(transaction?.type ?? "EXPENSE");
  const isEditing = !!transaction;

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("type", type);

    const result = isEditing
      ? await updateTransaction(transaction!.id, formData)
      : await createTransaction(formData);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success("Transação salva");
      onOpenChange(false);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar" : "Nova"} Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "EXPENSE" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("EXPENSE")}
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={type === "INCOME" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("INCOME")}
            >
              Receita
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" defaultValue={transaction?.description} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={transaction ? (transaction.amount / 100).toFixed(2) : undefined}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryId">Categoria</Label>
            <Select name="categoryId" defaultValue={transaction?.categoryId}>
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
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={transaction?.date ?? new Date().toISOString().split("T")[0]}
              required
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
