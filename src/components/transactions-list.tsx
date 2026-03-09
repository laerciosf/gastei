"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Pencil, Plus, ArrowLeftRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TransactionForm } from "@/components/transaction-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TransactionPagination } from "@/components/transaction-pagination";
import { deleteTransaction } from "@/lib/actions/transactions";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { formatCurrency } from "@/lib/utils/money";
import type { TransactionType } from "@/types";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  category: { id: string; name: string; color: string; type: TransactionType };
  user: { name: string | null };
  recurringOccurrence?: { id: string } | null;
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Pick<import("@/types").Category, "id" | "name" | "type">[];
  page: number;
  totalPages: number;
  totalIncome: number;
  totalExpense: number;
}

export function TransactionsList({ transactions, categories, page, totalPages, totalIncome, totalExpense }: TransactionsListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteTransaction);

  function handleEdit(tx: Transaction) {
    setEditing(tx);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Transação
        </Button>
      </div>

      {(totalIncome > 0 || totalExpense > 0) && (
        <div className="flex gap-4 text-sm">
          <span className="text-emerald-600 font-mono tabular-nums">+ {formatCurrency(totalIncome)}</span>
          <span className="text-rose-600 font-mono tabular-nums">- {formatCurrency(totalExpense)}</span>
          <span className={`font-semibold font-mono tabular-nums ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            = {formatCurrency(Math.abs(totalIncome - totalExpense))}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma transação encontrada</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </div>
        )}
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between rounded-md border p-4">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tx.category.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{tx.description}</p>
                  {tx.recurringOccurrence && (
                    <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                      <Repeat className="h-3 w-3" />
                      Recorrente
                    </Badge>
                  )}
                </div>
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
              <Button variant="ghost" size="icon" onClick={() => setDeleteId(tx.id)}>
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

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir transação"
        description="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        loading={deleting}
      />

      {totalPages > 1 && <TransactionPagination page={page} totalPages={totalPages} />}
    </>
  );
}
