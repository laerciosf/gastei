"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toUTCDate } from "@/lib/utils/date";
import { Trash2, Pencil, Plus, ArrowLeftRight, Repeat, List, LayoutGrid, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TransactionForm } from "@/components/transaction-form";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TransactionPagination } from "@/components/transaction-pagination";
import { deleteTransaction } from "@/lib/actions/transactions";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { formatCurrency } from "@/lib/utils/money";
import type { TransactionType, Tag } from "@/types";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  category: { id: string; name: string; color: string; type: TransactionType } | null;
  user: { name: string | null };
  recurringOccurrence?: { id: string } | null;
  tags: { tag: { id: string; name: string; color: string } }[];
  splitEntries?: { id: string; paid: boolean }[];
}

interface TransactionsListProps {
  transactions: Transaction[];
  categories: Pick<import("@/types").Category, "id" | "name" | "type">[];
  tags: Tag[];
  page: number;
  totalPages: number;
  totalIncome: number;
  totalExpense: number;
}

export function TransactionsList({
  transactions,
  categories,
  tags,
  page,
  totalPages,
  totalIncome,
  totalExpense,
}: TransactionsListProps) {
  const [viewMode, setViewMode] = useState<"list" | "category">("list");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteTransaction);
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleEdit(tx: Transaction) {
    setEditing(tx);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function handleTagFilter(tagId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tagId === "all") {
      params.delete("tagId");
    } else {
      params.set("tagId", tagId);
    }
    params.delete("page");
    router.push(`/transactions?${params.toString()}`);
  }

  const balance = totalIncome - totalExpense;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transação
          </Button>
          {tags.length > 0 && (
            <Select
              value={searchParams.get("tagId") ?? "all"}
              onValueChange={handleTagFilter}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Filtrar por tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tags</SelectItem>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
            title="Lista por data"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "category" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("category")}
            title="Agrupar por categoria"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(totalIncome > 0 || totalExpense > 0) && (
        <div className="flex gap-4 text-sm flex-wrap">
          <span className="text-emerald-600 font-mono tabular-nums">+ {formatCurrency(totalIncome)}</span>
          <span className="text-rose-600 font-mono tabular-nums">- {formatCurrency(totalExpense)}</span>
          <span className={`font-semibold font-mono tabular-nums ${balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            = {formatCurrency(Math.abs(balance))}
          </span>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowLeftRight className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma transação encontrada</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transação
          </Button>
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onEdit={handleEdit}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      ) : (
        <CategoryGroupedView
          transactions={transactions}
          onEdit={handleEdit}
          onDelete={setDeleteId}
        />
      )}

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        tags={tags}
        transaction={
          editing
            ? {
                id: editing.id,
                description: editing.description,
                amount: editing.amount,
                type: editing.type,
                categoryId: editing.category?.id ?? "",
                date: new Date(editing.date).toISOString().split("T")[0],
                tagIds: editing.tags.map((t) => t.tag.id),
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

      {viewMode === "list" && totalPages > 1 && (
        <TransactionPagination page={page} totalPages={totalPages} />
      )}
    </>
  );
}

function TransactionRow({
  tx,
  onEdit,
  onDelete,
  showCategoryDot = true,
}: {
  tx: Transaction;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  showCategoryDot?: boolean;
}) {
  return (
    <div className="rounded-md border">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          {showCategoryDot && (
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: tx.category?.color ?? "#6b7280" }}
            />
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{tx.description}</p>
              {tx.recurringOccurrence && (
                <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                  <Repeat className="h-3 w-3" />
                  Recorrente
                </Badge>
              )}
              {tx.splitEntries && tx.splitEntries.length > 0 && (
                tx.splitEntries.every((e) => e.paid) ? (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Dívida paga
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    Possui dívida
                  </Badge>
                )
              )}
              {tx.tags.map(({ tag }) => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {tx.category?.name ?? "Sem categoria"} · {format(toUTCDate(tx.date), "dd MMM yyyy", { locale: ptBR })}
              {tx.user.name && ` · ${tx.user.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`font-semibold font-mono tabular-nums ${tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
            {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
          </span>
          <Button variant="ghost" size="icon" onClick={() => onEdit(tx)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(tx.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: number;
  transactions: Transaction[];
}

function CategoryGroupedView({
  transactions,
  onEdit,
  onDelete,
}: {
  transactions: Transaction[];
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const groups = transactions.reduce<Record<string, CategoryGroup>>((acc, tx) => {
    const key = tx.category?.id ?? "uncategorized";
    if (!acc[key]) {
      acc[key] = {
        categoryId: key,
        categoryName: tx.category?.name ?? "Sem categoria",
        categoryColor: tx.category?.color ?? "#6b7280",
        total: 0,
        transactions: [],
      };
    }
    acc[key].total += tx.amount;
    acc[key].transactions.push(tx);
    return acc;
  }, {});

  const sortedGroups = Object.values(groups).sort((a, b) => b.total - a.total);

  for (const group of sortedGroups) {
    group.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  return (
    <div className="space-y-3">
      {sortedGroups.map((group) => (
        <CategoryAccordion
          key={group.categoryId}
          group={group}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function CategoryAccordion({
  group,
  onEdit,
  onDelete,
}: {
  group: CategoryGroup;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-md border p-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: group.categoryColor }}
            />
            <span className="font-medium">{group.categoryName}</span>
            <span className="text-sm text-muted-foreground">({group.transactions.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold font-mono tabular-nums text-rose-600">
              {formatCurrency(group.total)}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 pt-1 pl-4">
          {group.transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              onEdit={onEdit}
              onDelete={onDelete}
              showCategoryDot={false}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
