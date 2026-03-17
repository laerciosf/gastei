"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Receipt, Check, ChevronDown, History, Plus, X, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { createSplitEntries, toggleSplitPaid } from "@/lib/actions/splits";
import { formatCurrency } from "@/lib/utils/money";
import { toast } from "sonner";

interface SplitEntry {
  id: string;
  personName: string;
  amount: number;
  paid: boolean;
  paidAt: Date | null;
}

interface BillTransaction {
  id: string;
  description: string;
  amount: number;
  date: Date;
  category: { id: string; name: string; color: string; icon: string } | null;
  user: { name: string | null };
  splitEntries: SplitEntry[];
}

interface AvailableExpense {
  id: string;
  description: string;
  amount: number;
  date: Date;
}

interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  totalPending: number;
  totalPaid: number;
  transactions: BillTransaction[];
}

interface NewBillState {
  transactionId: string;
  transactionAmount: number;
  entries: { personName: string; amount: number }[];
}

interface BillsListProps {
  currentMonth: BillTransaction[];
  carryOver: BillTransaction[];
  totalPending: number;
  totalPaid: number;
  availableExpenses: AvailableExpense[];
}

export function BillsList({ currentMonth, carryOver, totalPending, totalPaid, availableExpenses }: BillsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPaid, setShowPaid] = useState(false);
  const [newBill, setNewBill] = useState<NewBillState | null>(null);
  const [saving, startSaveTransition] = useTransition();

  const hasData = currentMonth.length > 0 || carryOver.length > 0;

  function handleSelectTransaction(txId: string) {
    const tx = availableExpenses.find((e) => e.id === txId);
    if (!tx) return;
    setNewBill({
      transactionId: tx.id,
      transactionAmount: tx.amount,
      entries: [{ personName: "", amount: 0 }],
    });
  }

  function addEntry() {
    if (!newBill) return;
    setNewBill({ ...newBill, entries: [...newBill.entries, { personName: "", amount: 0 }] });
  }

  function removeEntry(index: number) {
    if (!newBill || newBill.entries.length <= 1) return;
    setNewBill({ ...newBill, entries: newBill.entries.filter((_, i) => i !== index) });
  }

  function updateEntry(index: number, field: "personName" | "amount", value: string | number) {
    if (!newBill) return;
    const entries = [...newBill.entries];
    entries[index] = { ...entries[index], [field]: value };
    setNewBill({ ...newBill, entries });
  }

  function handleSave() {
    if (!newBill) return;
    const validEntries = newBill.entries.filter((e) => e.personName.trim() && e.amount > 0);
    if (validEntries.length === 0) {
      toast.error("Adicione pelo menos uma pessoa com valor");
      return;
    }
    const sum = validEntries.reduce((acc, e) => acc + e.amount, 0);
    if (sum > newBill.transactionAmount) {
      toast.error("A soma das partes não pode exceder o valor da transação");
      return;
    }
    startSaveTransition(async () => {
      const result = await createSplitEntries(newBill.transactionId, validEntries);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Dívida criada");
        setDialogOpen(false);
        setNewBill(null);
      }
    });
  }

  function handleOpenDialog() {
    setNewBill(null);
    setDialogOpen(true);
  }

  const entrySum = newBill?.entries.reduce((acc, e) => acc + e.amount, 0) ?? 0;
  const canSave = newBill
    ? entrySum <= newBill.transactionAmount && newBill.entries.some((e) => e.personName.trim() && e.amount > 0)
    : false;

  const allCurrentGroups = buildCategoryGroups(currentMonth);
  const allCarryOverGroups = buildCategoryGroups(carryOver);

  const paidGroupCount =
    allCurrentGroups.filter((g) => g.totalPending === 0).length +
    allCarryOverGroups.filter((g) => g.totalPending === 0).length;

  const currentGroups = showPaid ? allCurrentGroups : allCurrentGroups.filter((g) => g.totalPending > 0);
  const carryOverGroups = showPaid ? allCarryOverGroups : allCarryOverGroups.filter((g) => g.totalPending > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm flex-wrap">
          {(totalPending > 0 || totalPaid > 0) && (
            <>
              <span className="text-rose-600 font-mono tabular-nums">
                Pendente: {formatCurrency(totalPending)}
              </span>
              <span className="text-emerald-600 font-mono tabular-nums">
                Pago: {formatCurrency(totalPaid)}
              </span>
            </>
          )}
          {paidGroupCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => setShowPaid(!showPaid)}
            >
              {showPaid ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPaid ? "Ocultar pagas" : `Mostrar pagas (${paidGroupCount})`}
            </Button>
          )}
        </div>
        <Button onClick={handleOpenDialog} disabled={availableExpenses.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Dívida
        </Button>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma dívida encontrada neste mês</p>
          {availableExpenses.length > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Dívida
            </Button>
          )}
        </div>
      ) : (
        <>
          {currentGroups.length > 0 && (
            <div className="space-y-2">
              {currentGroups.map((group) => (
                <CategoryCard key={group.categoryId} group={group} />
              ))}
            </div>
          )}

          {carryOverGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
                <History className="h-4 w-4" />
                <span className="font-medium">Pendentes de meses anteriores</span>
              </div>
              {carryOverGroups.map((group) => (
                <CategoryCard key={`carry-${group.categoryId}`} group={group} />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setNewBill(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Dívida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select onValueChange={handleSelectTransaction} value={newBill?.transactionId ?? ""}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma despesa" />
              </SelectTrigger>
              <SelectContent>
                {availableExpenses.map((tx) => (
                  <SelectItem key={tx.id} value={tx.id}>
                    {tx.description} — {formatCurrency(tx.amount)} · {format(new Date(tx.date), "dd MMM", { locale: ptBR })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {newBill && (
              <>
                <p className="text-sm text-muted-foreground">
                  Total da despesa: {formatCurrency(newBill.transactionAmount)}
                </p>
                {newBill.entries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Nome da pessoa"
                      value={entry.personName}
                      onChange={(e) => updateEntry(index, "personName", e.target.value)}
                      className="flex-1"
                    />
                    <CurrencyInput
                      name={`bill-entry-${index}`}
                      defaultValueCents={entry.amount}
                      key={`${newBill.transactionId}-${index}`}
                      className="w-[140px]"
                      onValueChange={(cents) => updateEntry(index, "amount", cents)}
                    />
                    {newBill.entries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeEntry(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addEntry} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar pessoa
                </Button>
                {entrySum > newBill.transactionAmount && (
                  <p className="text-xs text-destructive">
                    Soma ({formatCurrency(entrySum)}) excede o total ({formatCurrency(newBill.transactionAmount)})
                  </p>
                )}
                <Button className="w-full" onClick={handleSave} disabled={saving || !canSave}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildCategoryGroups(transactions: BillTransaction[]): CategoryGroup[] {
  const map: Record<string, CategoryGroup> = {};

  for (const tx of transactions) {
    const key = tx.category?.id ?? "uncategorized";
    if (!map[key]) {
      map[key] = {
        categoryId: key,
        categoryName: tx.category?.name ?? "Sem categoria",
        categoryColor: tx.category?.color ?? "#6b7280",
        totalPending: 0,
        totalPaid: 0,
        transactions: [],
      };
    }
    for (const entry of tx.splitEntries) {
      if (entry.paid) {
        map[key].totalPaid += entry.amount;
      } else {
        map[key].totalPending += entry.amount;
      }
    }
    map[key].transactions.push(tx);
  }

  return Object.values(map).sort((a, b) => b.totalPending - a.totalPending);
}

function CategoryCard({ group }: { group: CategoryGroup }) {
  const allPaid = group.totalPending === 0;
  const [open, setOpen] = useState(!allPaid);
  const total = group.totalPaid + group.totalPending;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: group.categoryColor }}
                />
                <CardTitle className="text-base">{group.categoryName}</CardTitle>
                {group.totalPending === 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-emerald-600">
                    <Check className="h-3 w-3 mr-0.5" />
                    Dívidas pagas
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                  {formatCurrency(group.totalPaid)} / {formatCurrency(total)}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-2 px-4 space-y-0">
            {group.transactions.map((tx) => (
              <TransactionEntries key={tx.id} tx={tx} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function TransactionEntries({ tx }: { tx: BillTransaction }) {
  const [toggling, startToggleTransition] = useTransition();

  function handleTogglePaid(entryId: string) {
    startToggleTransition(async () => {
      const result = await toggleSplitPaid(entryId);
      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      {tx.splitEntries.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between py-1 px-2 rounded-md hover:bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm truncate ${entry.paid ? "text-muted-foreground line-through" : ""}`}>
              {tx.description} — {entry.personName}
            </span>
            {entry.paidAt && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {format(new Date(entry.paidAt), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono tabular-nums text-sm">{formatCurrency(entry.amount)}</span>
            <Button
              variant={entry.paid ? "secondary" : "outline"}
              size="sm"
              className={`h-7 text-xs gap-1 ${entry.paid ? "text-emerald-600" : ""}`}
              disabled={toggling}
              onClick={() => handleTogglePaid(entry.id)}
            >
              {entry.paid ? <><Check className="h-3 w-3" /> Pago</> : "Pagar"}
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}
