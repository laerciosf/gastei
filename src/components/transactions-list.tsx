"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transaction-form";
import { deleteTransaction } from "@/lib/actions/transactions";
import { formatCurrency } from "@/lib/utils/money";
import { toast } from "sonner";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: Date;
  category: { id: string; name: string; color: string; type: string };
  user: { name: string | null };
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Category[];
}

export function TransactionsList({ transactions, categories }: TransactionsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  function handleEdit(tx: Transaction) {
    setEditing(tx);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;
    const result = await deleteTransaction(id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Transação excluída");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transação
        </Button>
      </div>

      <div className="space-y-2">
        {transactions.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">Nenhuma transação encontrada</p>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tx.category.color }} />
              <div>
                <p className="font-medium">{tx.description}</p>
                <p className="text-sm text-muted-foreground">
                  {tx.category.name} · {format(new Date(tx.date), "dd MMM yyyy", { locale: ptBR })}
                  {tx.user.name && ` · ${tx.user.name}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-semibold font-mono tabular-nums ${tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
                {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
              </span>
              <Button variant="ghost" size="icon" onClick={() => handleEdit(tx)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(tx.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        transaction={
          editing
            ? {
                id: editing.id,
                description: editing.description,
                amount: editing.amount,
                type: editing.type,
                categoryId: editing.category.id,
                date: new Date(editing.date).toISOString().split("T")[0],
              }
            : null
        }
      />
    </>
  );
}
