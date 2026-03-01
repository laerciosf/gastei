import { getMonthlySummary, getRecentTransactions } from "@/lib/actions/dashboard";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";

export default async function DashboardPage() {
  const [summary, recentTransactions] = await Promise.all([
    getMonthlySummary(),
    getRecentTransactions(),
  ]);

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <SummaryCards
        totalIncome={summary.totalIncome}
        totalExpense={summary.totalExpense}
        balance={summary.balance}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <CategoryChart data={summary.byCategory} />
        <RecentTransactions transactions={recentTransactions} />
      </div>
    </div>
  );
}
