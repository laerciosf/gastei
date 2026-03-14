"use client";

import { useState } from "react";
import { CheckCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SettlementDialog } from "@/components/settlement-dialog";
import { deleteTransaction } from "@/lib/actions/transactions";
import { useDeleteAction } from "@/hooks/use-delete-action";
import { formatCurrency } from "@/lib/utils/money";
import type { SplitBalance, SplitTransaction, Settlement } from "@/types";

interface SplitsListProps {
  balances: SplitBalance[];
  splits: SplitTransaction[];
  settlements: Settlement[];
  members: { id: string; name: string | null }[];
}

export function SplitsList({ balances, splits, settlements }: SplitsListProps) {
  const [settlementTarget, setSettlementTarget] = useState<SplitBalance | null>(null);
  const { deleteId, setDeleteId, deleting, handleDelete } = useDeleteAction(deleteTransaction);

  const hasContent = splits.length > 0 || settlements.length > 0;
  const hasBalances = balances.length > 0;

  return (
    <>
      {/* Balance summary */}
      <section>
        {hasBalances ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {balances.map((balance) => (
              <Card key={balance.memberId}>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        balance.amount > 0 ? "text-rose-600" : "text-emerald-600"
                      }`}
                    >
                      {balance.amount > 0
                        ? `Você deve ${formatCurrency(balance.amount)} a ${balance.memberName ?? "membro"}`
                        : `${balance.memberName ?? "Membro"} te deve ${formatCurrency(Math.abs(balance.amount))}`}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setSettlementTarget(balance)}>
                    Acertar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-sm">Todas as contas estão acertadas</span>
            </CardContent>
          </Card>
        )}
      </section>

      {!hasContent && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma divisão neste mês</p>
        </div>
      )}

      {/* Split transactions */}
      {splits.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Despesas divididas</h3>
          <div className="space-y-3">
            {splits.map((split) => (
              <Card key={split.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{split.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(split.date), "dd 'de' MMMM", { locale: ptBR })}
                        {" · "}
                        Pago por {split.payer.name ?? "membro"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold font-mono tabular-nums">
                        {formatCurrency(split.amount)}
                      </p>
                      <div
                        className="mt-1 h-2 w-2 rounded-full inline-block"
                        style={{ backgroundColor: split.category.color }}
                      />
                      <span className="ml-1 text-xs text-muted-foreground">
                        {split.category.name}
                      </span>
                    </div>
                  </div>
                  {split.shares.length > 0 && (
                    <div className="mt-3 border-t pt-3 space-y-1">
                      {split.shares.map((share) => (
                        <div
                          key={share.userId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-muted-foreground">
                            {share.userName ?? "Membro"}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatCurrency(share.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Settlements */}
      {settlements.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Acertos</h3>
          <div className="space-y-3">
            {settlements.map((settlement) => (
              <Card key={settlement.id}>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{settlement.from.name ?? "Membro"}</span>
                      {" acertou "}
                      <span className="font-semibold font-mono tabular-nums">
                        {formatCurrency(settlement.amount)}
                      </span>
                      {" com "}
                      <span className="font-medium">{settlement.to.name ?? "membro"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(settlement.date), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(settlement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Settlement dialog */}
      {settlementTarget && (
        <SettlementDialog
          open={!!settlementTarget}
          onOpenChange={(open) => !open && setSettlementTarget(null)}
          memberId={settlementTarget.memberId}
          memberName={settlementTarget.memberName}
          maxAmount={Math.abs(settlementTarget.amount)}
          direction={settlementTarget.amount > 0 ? "you-owe" : "they-owe"}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir acerto"
        description="Tem certeza que deseja excluir este acerto? Os saldos serão recalculados."
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
