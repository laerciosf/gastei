import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftRight } from "lucide-react";
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
        <CardTitle>Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ArrowLeftRight className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma transação ainda</p>
            <Link href="/transactions" className="mt-2 text-sm text-primary hover:underline">
              Ver transações
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tx.category?.color ?? "#6b7280" }} />
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), "dd MMM", { locale: ptBR })} · {tx.category?.name ?? "Sem categoria"}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-semibold font-mono tabular-nums ${tx.type === "INCOME" ? "text-emerald-600" : "text-rose-600"}`}>
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
