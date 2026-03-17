import { getTransactions } from "@/lib/actions/transactions";
import { getCategories } from "@/lib/actions/categories";
import { getTags } from "@/lib/actions/tags";
import { TransactionsList } from "@/components/transactions-list";
import { MonthPicker } from "@/components/month-picker";

interface Props {
  searchParams: Promise<{ month?: string; categoryId?: string; type?: string; search?: string; tagId?: string; page?: string }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  const currentMonth = params.month && monthRegex.test(params.month) ? params.month : new Date().toISOString().slice(0, 7);
  const page = params.page ? Math.max(1, parseInt(params.page, 10) || 1) : 1;

  const validTypes = ["INCOME", "EXPENSE"] as const;
  const type = validTypes.includes(params.type as typeof validTypes[number])
    ? (params.type as "INCOME" | "EXPENSE")
    : undefined;

  const [result, categories, tags] = await Promise.all([
    getTransactions({
      month: currentMonth,
      categoryId: params.categoryId,
      type,
      search: params.search,
      tagId: params.tagId,
      page,
    }),
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Transações</h2>
        <MonthPicker currentMonth={currentMonth} />
      </div>
      <TransactionsList
        transactions={result.transactions}
        categories={categories}
        tags={tags}
        page={result.page}
        totalPages={result.totalPages}
        totalIncome={result.totalIncome}
        totalExpense={result.totalExpense}
      />
    </div>
  );
}
