import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toUTCDate } from "@/lib/utils/date";
import { ArrowLeftRight, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";
import type { TransactionType } from "@/types";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  date: Date;
  category: { name: string; color: string } | null;
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Transações Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-medium">Nenhuma transação ainda</p>
            <Link href="/transactions" className="mt-2 text-sm text-primary hover:underline">
              Ver transações
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg p-2.5 transition-colors hover:bg-accent/50">
                <div className="flex items-center gap-3">
                  <div className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: tx.category?.color ?? "#6b7280" }} />
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(toUTCDate(tx.date), "dd MMM", { locale: ptBR })} · {tx.category?.name ?? "Sem categoria"}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold font-mono tabular-nums ${tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {tx.type === "INCOME" ? "+" : "-"} {formatCurrency(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
