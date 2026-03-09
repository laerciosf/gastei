import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getBudgets } from "@/lib/actions/budget";
import { getCategories } from "@/lib/actions/categories";
import { BudgetList } from "@/components/budget-list";

export default async function BudgetPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [year, month] = currentMonth.split("-").map(Number);
  const formattedMonth = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR });

  const [budgets, categories] = await Promise.all([
    getBudgets(currentMonth),
    getCategories(),
  ]);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Orçamento — <span className="capitalize">{formattedMonth}</span></h2>
      <BudgetList budgets={budgets} categories={categories} currentMonth={currentMonth} />
    </div>
  );
}
