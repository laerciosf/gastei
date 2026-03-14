import { getHousehold, getSentInvites, getPendingInvites } from "@/lib/actions/household";
import { requireAuth } from "@/lib/auth-guard";
import { HouseholdMembers } from "@/components/household-members";
import { PendingInvites } from "@/components/pending-invites";
import { SplitRatioConfig } from "@/components/split-ratio-config";

export default async function HouseholdPage() {
  const session = await requireAuth();
  const [household, sentInvites, pendingInvites] = await Promise.all([
    getHousehold(),
    getSentInvites(),
    getPendingInvites(),
  ]);

  return (
    <div className="space-y-8">
      {pendingInvites.length > 0 && (
        <PendingInvites invites={pendingInvites} />
      )}

      <h2 className="text-xl font-semibold">Membros</h2>

      {household ? (
        <HouseholdMembers
          household={household}
          currentUserId={session.user.id}
          sentInvites={sentInvites}
        />
      ) : (
        <p className="text-muted-foreground">Nenhum grupo encontrado.</p>
      )}

      {household && (
        <SplitRatioConfig
          members={household.members}
          currentRatio={household.defaultSplitRatio as Record<string, number> | null}
        />
      )}
    </div>
  );
}
