"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createSettlement } from "@/lib/actions/splits";
import { formatCurrency } from "@/lib/utils/money";

interface SettlementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string | null;
  maxAmount: number;
}

export function SettlementDialog({
  open,
  onOpenChange,
  memberId,
  memberName,
  maxAmount,
}: SettlementDialogProps) {
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await createSettlement(formData);
        if (result && "error" in result && result.error) {
          toast.error(result.error);
        } else {
          toast.success("Acerto registrado");
          onOpenChange(false);
        }
      } catch {
        toast.error("Erro ao registrar acerto");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Acertar com {memberName ?? "membro"}</DialogTitle>
          <DialogDescription>
            Você deve {formatCurrency(maxAmount)}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <input type="hidden" name="toUserId" value={memberId} />
          <div className="py-4">
            <CurrencyInput name="amount" defaultValueCents={maxAmount} />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
