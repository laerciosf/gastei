"use client";

import { useState } from "react";
import { UserPlus, UserMinus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { inviteMember, removeMember, cancelInvite } from "@/lib/actions/household";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Household {
  id: string;
  name: string;
  members: Member[];
}

interface SentInvite {
  id: string;
  invitee: { id: string; name: string | null; email: string };
}

interface Props {
  household: Household;
  currentUserId: string;
  sentInvites: SentInvite[];
}

export function HouseholdMembers({ household, currentUserId, sentInvites }: Props) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removingMember, setRemovingMember] = useState<{ id: string; name: string | null } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await inviteMember(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Convite enviado");
      setInviteOpen(false);
    }
    setLoading(false);
  }

  async function handleRemove() {
    if (!removingMember) return;
    setRemoving(true);
    const result = await removeMember(removingMember.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Membro removido");
    }
    setRemoving(false);
    setRemovingMember(null);
  }

  async function handleCancelInvite(inviteId: string) {
    setCancellingId(inviteId);
    const result = await cancelInvite(inviteId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Convite cancelado");
    }
    setCancellingId(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{household.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {household.members.map((member) => (
            <div key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {member.name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{member.name ?? "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
              </div>
              {member.id !== currentUserId && (
                <Button variant="ghost" size="icon" onClick={() => setRemovingMember({ id: member.id, name: member.name })}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {sentInvites.length > 0 && (
            <div className="border-t pt-4 mt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Convites Enviados</p>
              {sentInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {invite.invitee.name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-muted-foreground">
                        {invite.invitee.name ?? "Sem nome"}
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                          Pendente
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">{invite.invitee.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={cancellingId === invite.id}
                    onClick={() => handleCancelInvite(invite.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={() => setInviteOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />
        Convidar Membro
      </Button>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do membro</Label>
              <Input id="email" name="email" type="email" placeholder="membro@email.com" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Convidando..." : "Convidar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
        title="Remover membro"
        description={`Tem certeza que deseja remover ${removingMember?.name ?? "este membro"} do grupo?`}
        onConfirm={handleRemove}
        loading={removing}
      />
    </div>
  );
}
