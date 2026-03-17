"use client";

import { useState } from "react";
import { Repeat, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RecurringForm } from "@/components/recurring-form";
import { OccurrenceCheckButton } from "@/components/occurrence-check-button";
import { deleteRecurringTransaction } from "@/lib/actions/recurring";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { formatCurrency } from "@/lib/utils/money";
import { getCurrentMonth } from "@/lib/utils/date";
import type { TransactionType } from "@/types";

interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  installments: number | null;
  category: { id: string; name: string; color: string; type: TransactionType };
}

interface Occurrence {
  id: string;
  month: string;
  paid: boolean;
  transaction: {
    id: string;
    description: string;
    amount: number;
    type: TransactionType;
    date: string | Date;
  } | null;
  recurringTransaction: {
    id: string;
    description: string;
    category: { id: string; name: string; color: string; type: TransactionType };
  };
}

type OccurrenceStatus = "paid" | "pending" | "overdue";

function getOccurrenceStatus(occ: Occurrence): OccurrenceStatus {
  if (occ.paid) return "paid";
  if (occ.month > getCurrentMonth()) return "pending";
  return "overdue";
}

const statusConfig: Record<OccurrenceStatus, { label: string; className: string }> = {
  paid: {
    label: "Pago",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  pending: {
    label: "Pendente",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  },
  overdue: {
    label: "Atrasado",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};

interface RecurringListProps {
  recurring: RecurringTransaction[];
  occurrences: Occurrence[];
  categories: Pick<import("@/types").Category, "id" | "name" | "type" | "color">[];
}

function formatMonth(month: string) {
  const [year, m] = month.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${year}`;
}

export function RecurringList({ recurring, occurrences, categories }: RecurringListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteRecurringTransaction);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleEdit(item: RecurringTransaction) {
    setEditing(item);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  const occurrencesByTemplate = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = occ.recurringTransaction.id;
    if (!occurrencesByTemplate.has(key)) {
      occurrencesByTemplate.set(key, []);
    }
    occurrencesByTemplate.get(key)!.push(occ);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Recorrência
        </Button>
      </div>

      <div className="space-y-3">
        {recurring.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Repeat className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma recorrência cadastrada</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleNew}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Recorrência
            </Button>
          </div>
        )}
        {recurring.map((item) => {
          const templateOccurrences = occurrencesByTemplate.get(item.id) ?? [];
          const isExpanded = expanded.has(item.id);

          return (
            <div key={item.id} className="rounded-md border">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />
                    }
                  </button>
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.category.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.description}</p>
                      <Badge variant="secondary">
                        {item.type === "INCOME" ? "Receita" : "Despesa"}
                      </Badge>
                      {item.installments ? (
                        <Badge variant="outline" className="text-xs">
                          {item.installments}x
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-emerald-600">
                          Renova automaticamente
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.category.name} · Dia {item.dayOfMonth}
                      {item.startMonth && ` · Início ${formatMonth(item.startMonth)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`font-semibold font-mono tabular-nums ${item.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
                      {formatCurrency(item.amount)}
                    </span>
                    {item.installments && item.installments > 1 && (
                      <p className="text-xs text-muted-foreground font-mono tabular-nums">
                        {formatCurrency(Math.round(item.amount / item.installments))}/mês
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {isExpanded && templateOccurrences.length > 0 && (
                <div className="border-t bg-muted/30">
                  {templateOccurrences.map((occ) => {
                    const status = getOccurrenceStatus(occ);
                    const config = statusConfig[status];
                    return (
                      <div
                        key={occ.id}
                        className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0"
                      >
                        <div className="flex items-center gap-3 pl-7">
                          <OccurrenceCheckButton occurrenceId={occ.id} paid={occ.paid} />
                          <span className="text-sm font-medium w-20">
                            {formatMonth(occ.month)}
                          </span>
                          {item.installments && (
                            <span className="text-xs text-muted-foreground">
                              Parcela {templateOccurrences.indexOf(occ) + 1}/{item.installments}
                            </span>
                          )}
                          <Badge variant="secondary" className={`text-xs ${config.className}`}>
                            {config.label}
                          </Badge>
                        </div>
                        <span className={`text-sm font-mono tabular-nums ${item.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
                          {formatCurrency(
                            occ.transaction?.amount
                              ?? (item.installments ? Math.round(item.amount / item.installments) : item.amount)
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && templateOccurrences.length === 0 && (
                <div className="border-t bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground pl-7">Nenhuma transação gerada ainda</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <RecurringForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        recurring={editing}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Desativar recorrência"
        description="Tem certeza que deseja desativar esta recorrência? As transações já criadas serão mantidas."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
