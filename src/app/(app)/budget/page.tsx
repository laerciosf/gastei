import { getBudgets } from "@/lib/actions/budget";
import { getCategories } from "@/lib/actions/categories";
import { BudgetList } from "@/components/budget-list";

export default async function BudgetPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [budgets, categories] = await Promise.all([
    getBudgets(currentMonth),
    getCategories(),
  ]);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Orçamento — {currentMonth}</h2>
      <BudgetList budgets={budgets} categories={categories} currentMonth={currentMonth} />
    </div>
  );
}
