"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createGoal, updateGoal, type GoalWithProgress } from "@/lib/actions/goals";
import { toast } from "sonner";

interface GoalFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalWithProgress | null;
}

export function GoalForm({ open, onOpenChange, goal }: GoalFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!goal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const name = formData.get("name") as string;
    if (!name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    const targetAmount = formData.get("targetAmount") as string;
    if (!targetAmount || parseFloat(targetAmount) <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    setLoading(true);
    const result = isEditing
      ? await updateGoal(goal.id, formData)
      : await createGoal(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEditing ? "Meta atualizada" : "Meta criada");
      onOpenChange(false);
    }
    setLoading(false);
  }

  const formatDateForInput = (date: string | Date | null): string => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              placeholder="Ex: Viagem, Reserva de emergência..."
              defaultValue={goal?.name ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select name="type" defaultValue={goal?.type ?? "SAVINGS"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAVINGS">Economia</SelectItem>
                <SelectItem value="SPENDING">Redução de Gasto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetAmount">Valor alvo</Label>
            <CurrencyInput
              id="targetAmount"
              name="targetAmount"
              defaultValue={goal ? (goal.targetAmount / 100).toFixed(2) : undefined}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Select name="icon" defaultValue={goal?.icon ?? "piggy-bank"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piggy-bank">Cofrinho</SelectItem>
                  <SelectItem value="flag">Bandeira</SelectItem>
                  <SelectItem value="target">Alvo</SelectItem>
                  <SelectItem value="trophy">Troféu</SelectItem>
                  <SelectItem value="star">Estrela</SelectItem>
                  <SelectItem value="heart">Coração</SelectItem>
                  <SelectItem value="home">Casa</SelectItem>
                  <SelectItem value="car">Carro</SelectItem>
                  <SelectItem value="plane">Avião</SelectItem>
                  <SelectItem value="utensils">Comida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input
                id="color"
                name="color"
                type="color"
                defaultValue={goal?.color ?? "#10b981"}
                className="h-9 w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDate">Prazo (opcional)</Label>
            <Input
              id="targetDate"
              name="targetDate"
              type="date"
              defaultValue={goal ? formatDateForInput(goal.targetDate) : ""}
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
