"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, Flag, PiggyBank, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { GoalForm } from "@/components/goal-form";
import { GoalEntryForm } from "@/components/goal-entry-form";
import { formatCurrency } from "@/lib/utils/money";
import { deleteGoal, deleteGoalEntry, type GoalDetail, type GoalWithProgress } from "@/lib/actions/goals";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { toast } from "sonner";
import type { GoalType } from "@/types";

interface GoalListProps {
  goals: GoalDetail[];
  currentUserId: string;
}

const TYPE_CONFIG = {
  SAVINGS: { label: "Economia", badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: PiggyBank },
  SPENDING: { label: "Redução", badgeClass: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Flag },
} as const;

function progressColor(percentage: number) {
  if (percentage >= 100) return "bg-emerald-500";
  if (percentage >= 80) return "bg-amber-500";
  return "bg-blue-500";
}

function progressTextColor(percentage: number) {
  if (percentage >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (percentage >= 80) return "text-amber-600 dark:text-amber-400";
  return "text-blue-600 dark:text-blue-400";
}

function formatTargetDate(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(date));
}

function paceStatus(goal: GoalWithProgress): { label: string; color: string } | null {
  if (!goal.targetDate || goal.percentage >= 100) return null;

  const now = new Date();
  const target = new Date(goal.targetDate);
  const created = new Date(goal.createdAt);

  if (target <= now) return { label: "Vencida", color: "text-rose-600 dark:text-rose-400" };

  const totalDays = Math.max(1, (target.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(0, (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = (elapsedDays / totalDays) * 100;

  if (goal.percentage >= expectedProgress) {
    return { label: "No ritmo", color: "text-emerald-600 dark:text-emerald-400" };
  }
  return { label: "Atrasada", color: "text-amber-600 dark:text-amber-400" };
}

export function GoalList({ goals, currentUserId }: GoalListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalWithProgress | null>(null);
  const [filter, setFilter] = useState<GoalType | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteGoal);

  const filtered = filter === "ALL" ? goals : goals.filter((g) => g.type === filter);

  async function handleDeleteEntry() {
    if (!deletingEntryId) return;
    const result = await deleteGoalEntry(deletingEntryId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Registro removido");
    }
    setDeletingEntryId(null);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["ALL", "SAVINGS", "SPENDING"] as const).map((t) => (
            <Button
              key={t}
              variant={filter === t ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(t)}
            >
              {t === "ALL" ? "Todas" : TYPE_CONFIG[t].label}
            </Button>
          ))}
        </div>
        <Button onClick={() => { setEditGoal(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Meta
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((goal) => {
          const config = TYPE_CONFIG[goal.type];
          const TypeIcon = config.icon;
          const pace = paceStatus(goal);
          const isExpanded = expandedId === goal.id;
          const isOwner = goal.userId === currentUserId;

          return (
            <Collapsible key={goal.id} open={isExpanded} onOpenChange={(open) => setExpandedId(open ? goal.id : null)}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{goal.name}</span>
                    </div>
                    <Badge variant="secondary" className={config.badgeClass}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-mono tabular-nums">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-muted-foreground font-mono tabular-nums">{formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${progressColor(goal.percentage)}`}
                        style={{ width: `${Math.min(goal.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className={`text-xs font-medium font-mono tabular-nums ${progressTextColor(goal.percentage)}`}>
                        {goal.percentage}%
                      </span>
                      {goal.targetDate && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Até {formatTargetDate(goal.targetDate)}</span>
                          {pace && <span className={`ml-1 font-medium ${pace.color}`}>· {pace.label}</span>}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Ocultar" : "Detalhes"}
                      </Button>
                    </CollapsibleTrigger>
                    {isOwner && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditGoal(goal); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <CollapsibleContent>
                    <div className="mt-3 space-y-3">
                      <GoalEntryForm goalId={goal.id} currentAmount={goal.currentAmount} />

                      {goal.entries.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Histórico</p>
                          {goal.entries.map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono tabular-nums font-medium ${entry.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  {entry.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(entry.amount))}
                                </span>
                                {entry.note && <span className="text-muted-foreground">· {entry.note}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(entry.createdAt))}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => setDeletingEntryId(entry.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <PiggyBank className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-3 text-sm font-medium">Nenhuma meta criada</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">
            Crie metas de economia ou redução de gastos e acompanhe seu progresso
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEditGoal(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Meta
          </Button>
        </div>
      )}

      <GoalForm open={formOpen} onOpenChange={setFormOpen} goal={editGoal} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir meta"
        description="Tem certeza que deseja excluir esta meta? Todo o histórico de depósitos será removido."
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={!!deletingEntryId}
        onOpenChange={(open) => !open && setDeletingEntryId(null)}
        title="Remover registro"
        description="Tem certeza que deseja remover este registro? O saldo da meta será recalculado."
        onConfirm={handleDeleteEntry}
        loading={false}
      />
    </>
  );
}
