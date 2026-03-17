import { formatCurrency } from "@/lib/utils/money";

interface BalanceCardProps {
  balance: number;
}

export function BalanceCard({ balance }: BalanceCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
      <span className="text-[11px] text-muted-foreground font-medium">Saldo</span>
      <span
        className={`text-sm font-semibold font-mono tabular-nums ${
          balance >= 0 ? "text-emerald-600" : "text-rose-600"
        }`}
      >
        {formatCurrency(Math.abs(balance))}
      </span>
    </div>
  );
}
