"use client";

import { useState } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inviteMember, removeMember } from "@/lib/actions/household";
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

export function HouseholdMembers({ household, currentUserId }: { household: Household; currentUserId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await inviteMember(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Membro convidado");
      setInviteOpen(false);
    }
    setLoading(false);
  }

  async function handleRemove(userId: string, name: string | null) {
    if (!confirm(`Remover ${name ?? "este membro"} do household?`)) return;
    const result = await removeMember(userId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Membro removido");
    }
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
                <Button variant="ghost" size="icon" onClick={() => handleRemove(member.id, member.name)}>
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
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
    </div>
  );
}
