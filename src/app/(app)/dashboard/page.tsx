import Link from "next/link";
import { Plus } from "lucide-react";
import { getMonthlySummary, getRecentTransactions, getTagSummary } from "@/lib/actions/dashboard";
import { getInsights } from "@/lib/actions/insights";
import { getAnnualSummary } from "@/lib/actions/annual";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DashboardInsights } from "@/components/dashboard/dashboard-insights";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { AnnualChart } from "@/components/dashboard/annual-chart";
import { TagSummary } from "@/components/dashboard/tag-summary";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const [summary, recentTransactions, insights, tagSummary, annualSummary] = await Promise.all([
    getMonthlySummary(),
    getRecentTransactions(),
    getInsights(),
    getTagSummary(),
    getAnnualSummary(),
  ]);

  const isEmpty = summary.totalIncome === 0 && summary.totalExpense === 0 && recentTransactions.length === 0;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6">
            <Plus className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">Sem dados neste mês</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Comece registrando suas receitas e despesas para acompanhar suas finanças.
          </p>
          <Button asChild className="mt-6">
            <Link href="/transactions">
              <Plus className="mr-2 h-4 w-4" />
              Criar Transação
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <SummaryCards
            totalIncome={summary.totalIncome}
            totalExpense={summary.totalExpense}
            balance={summary.balance}
          />
          <DashboardInsights insights={insights} />
          <div className="grid gap-6 md:grid-cols-2">
            <CategoryChart data={summary.byCategory} />
            <RecentTransactions transactions={recentTransactions} />
          </div>
          <AnnualChart
            chartData={annualSummary.chartData}
            categories={annualSummary.categories}
            currentMonthIndex={annualSummary.currentMonthIndex}
          />
          <TagSummary data={tagSummary} />
        </>
      )}
    </div>
  );
}
