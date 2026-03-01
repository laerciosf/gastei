import { getTransactions } from "@/lib/actions/transactions";
import { getCategories } from "@/lib/actions/categories";
import { TransactionsList } from "@/components/transactions-list";

interface Props {
  searchParams: Promise<{ month?: string; categoryId?: string; type?: string; search?: string }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentMonth = params.month ?? new Date().toISOString().slice(0, 7);

  const [transactions, categories] = await Promise.all([
    getTransactions({
      month: currentMonth,
      categoryId: params.categoryId,
      type: params.type as "INCOME" | "EXPENSE" | undefined,
      search: params.search,
    }),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transações</h2>
      <TransactionsList transactions={transactions} categories={categories} />
    </div>
  );
}
