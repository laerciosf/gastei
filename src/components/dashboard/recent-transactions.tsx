import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/money";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: string;
  date: Date;
  category: { name: string; color: string };
}

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transações Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">Nenhuma transação ainda</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tx.category.color }} />
                  <div>
                    <p className="text-sm font-medium">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), "dd MMM", { locale: ptBR })} · {tx.category.name}
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
