import { getHousehold } from "@/lib/actions/household";
import { requireAuth } from "@/lib/auth-guard";
import { HouseholdMembers } from "@/components/household-members";

export default async function HouseholdPage() {
  const session = await requireAuth();
  const household = await getHousehold();

  if (!household) {
    return (
      <div>
        <h2 className="text-2xl font-bold">Household</h2>
        <p className="text-muted-foreground">Nenhum household encontrado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Household</h2>
      <HouseholdMembers household={household} currentUserId={session.user.id} />
    </div>
  );
}
