"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { createTransaction, updateTransaction, createInstallmentTransaction } from "@/lib/actions/transactions";
import { validateTransactionFormData } from "@/lib/validations/shared";
import { toast } from "sonner";
import { TagPicker } from "@/components/tag-picker";
import type { TransactionType, Category, Tag } from "@/types";

type TransactionFormCategory = Pick<Category, "id" | "name" | "type">;

interface TransactionData {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  tagIds?: string[];
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: TransactionFormCategory[];
  tags: Tag[];
  transaction?: TransactionData | null;
}

export function TransactionForm({ open, onOpenChange, categories, tags, transaction }: TransactionFormProps) {
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(transaction?.type ?? "EXPENSE");
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [tagIds, setTagIds] = useState<string[]>(transaction?.tagIds ?? []);
  const [isInstallment, setIsInstallment] = useState(false);
  const isEditing = !!transaction;

  useEffect(() => {
    if (open) {
      setType(transaction?.type ?? "EXPENSE");
      setCategoryId(transaction?.categoryId ?? "");
      setTagIds(transaction?.tagIds ?? []);
      setIsInstallment(false);
    }
  }, [open, transaction?.type, transaction?.categoryId, transaction?.tagIds]);

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
    formData.set("tagIds", JSON.stringify(tagIds));

    const validationError = validateTransactionFormData(formData);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (isInstallment && !isEditing) {
      const installments = parseInt(formData.get("installments") as string, 10);
      if (isNaN(installments) || installments < 2 || installments > 48) {
        toast.error("Número de parcelas deve ser entre 2 e 48");
        return;
      }
    }

    setLoading(true);

    const result = isEditing
      ? await updateTransaction(transaction!.id, formData)
      : isInstallment
        ? await createInstallmentTransaction(formData)
        : await createTransaction(formData);

    if (result.error) {
      toast.error(result.error);
      setLoading(false);
    } else {
      toast.success(isInstallment ? "Transação parcelada criada" : "Transação salva");
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
            <Input id="description" name="description" defaultValue={transaction?.description} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">{isInstallment ? "Valor total" : "Valor"}</Label>
            <CurrencyInput
              id="amount"
              name="amount"
              defaultValueCents={transaction?.amount ?? 0}
            />
          </div>
          {!isEditing && (
            <div className="flex items-center justify-between">
              <Label htmlFor="installment-toggle">Parcelado?</Label>
              <Switch
                id="installment-toggle"
                checked={isInstallment}
                onCheckedChange={setIsInstallment}
              />
            </div>
          )}
          {isInstallment && !isEditing && (
            <div className="space-y-2">
              <Label htmlFor="installments">Número de parcelas</Label>
              <Input
                id="installments"
                name="installments"
                type="number"
                min={2}
                max={48}
                placeholder="Ex: 12"
                required
              />
              <p className="text-xs text-muted-foreground">
                O valor será dividido igualmente entre as parcelas
              </p>
            </div>
          )}
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
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={transaction?.date ?? new Date().toLocaleDateString("en-CA")}
              required
            />
          </div>
          <TagPicker tags={tags} selectedTagIds={tagIds} onChange={setTagIds} />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
