import { getBills } from "@/lib/actions/bills";
import { BillsList } from "@/components/bills-list";
import { MonthPicker } from "@/components/month-picker";
import { safeMonth } from "@/lib/utils/date";
import { Receipt } from "lucide-react";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function BillsPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentMonth = safeMonth(params.month);

  const result = await getBills(currentMonth);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Dívidas</h2>
        </div>
        <MonthPicker currentMonth={currentMonth} />
      </div>
      <BillsList
        currentMonth={result.currentMonth}
        carryOver={result.carryOver}
        totalPending={result.totalPending}
        totalPaid={result.totalPaid}
        availableExpenses={result.availableExpenses}
      />
    </div>
  );
}
