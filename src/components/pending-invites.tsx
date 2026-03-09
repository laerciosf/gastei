"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvite, rejectInvite } from "@/lib/actions/household";
import { toast } from "sonner";

interface Invite {
  id: string;
  household: { id: string; name: string };
  inviter: { id: string; name: string | null; email: string };
}

export function PendingInvites({ invites }: { invites: Invite[] }) {
  const { update } = useSession();
  const router = useRouter();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function handleAccept(invite: Invite) {
    setProcessingId(invite.id);
    const result = await acceptInvite(invite.id);
    if (result.error) {
      toast.error(result.error);
      setProcessingId(null);
      return;
    }
    toast.success(`Você agora faz parte de "${invite.household.name}"`);
    await update({ householdId: result.newHouseholdId });
    router.refresh();
    setProcessingId(null);
  }

  async function handleReject(inviteId: string) {
    setProcessingId(inviteId);
    const result = await rejectInvite(inviteId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Convite recusado");
    }
    setProcessingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convites Recebidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {invites.map((invite) => (
          <div key={invite.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">{invite.household.name}</p>
              <p className="text-sm text-muted-foreground">
                Convidado por {invite.inviter.name ?? invite.inviter.email}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={processingId !== null}
                onClick={() => handleAccept(invite)}
              >
                <Check className="mr-1 h-4 w-4" />
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={processingId !== null}
                onClick={() => handleReject(invite.id)}
              >
                <X className="mr-1 h-4 w-4" />
                Recusar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
