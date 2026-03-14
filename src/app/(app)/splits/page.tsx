import { getBalance, getSplits, getSettlements } from "@/lib/actions/splits";
import { getHousehold } from "@/lib/actions/household";
import { SplitsList } from "@/components/splits-list";
import { MonthPicker } from "@/components/month-picker";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function SplitsPage({ searchParams }: Props) {
  const params = await searchParams;
  const monthRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
  const currentMonth =
    params.month && monthRegex.test(params.month)
      ? params.month
      : new Date().toISOString().slice(0, 7);

  const [balances, splits, settlements, household] = await Promise.all([
    getBalance(),
    getSplits(currentMonth),
    getSettlements(currentMonth),
    getHousehold(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Divisões</h2>
        <MonthPicker currentMonth={currentMonth} />
      </div>
      <SplitsList
        balances={balances}
        splits={splits}
        settlements={settlements}
        members={household?.members ?? []}
      />
    </div>
  );
}
