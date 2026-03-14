"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateDefaultSplitRatio } from "@/lib/actions/household";
import { toast } from "sonner";

interface SplitRatioConfigProps {
  members: { id: string; name: string | null }[];
  currentRatio: Record<string, number> | null;
}

function buildInitialRatios(
  members: { id: string; name: string | null }[],
  currentRatio: Record<string, number> | null,
): Record<string, number> {
  if (currentRatio) return { ...currentRatio };
  const equal = Math.floor(100 / members.length);
  const ratios: Record<string, number> = {};
  members.forEach((m, i) => {
    ratios[m.id] = i === 0 ? 100 - equal * (members.length - 1) : equal;
  });
  return ratios;
}

export function SplitRatioConfig({ members, currentRatio }: SplitRatioConfigProps) {
  const [ratios, setRatios] = useState<Record<string, number>>(() =>
    buildInitialRatios(members, currentRatio),
  );
  const [isPending, startTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();

  if (members.length < 2) return null;

  const total = Object.values(ratios).reduce((a, b) => a + b, 0);
  const isValid = total === 100;

  function handleChange(memberId: string, value: string) {
    const parsed = parseInt(value, 10);
    setRatios((prev) => ({ ...prev, [memberId]: isNaN(parsed) ? 0 : parsed }));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateDefaultSplitRatio(ratios);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Proporção salva com sucesso");
      }
    });
  }

  function handleReset() {
    const equal = Math.floor(100 / members.length);
    const newRatios: Record<string, number> = {};
    members.forEach((m, i) => {
      newRatios[m.id] = i === 0 ? 100 - equal * (members.length - 1) : equal;
    });
    setRatios(newRatios);

    startResetTransition(async () => {
      const result = await updateDefaultSplitRatio(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Proporção redefinida para divisão igual");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proporção padrão de divisão</CardTitle>
        <CardDescription>
          Define como as despesas são divididas por padrão entre os membros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <Label className="w-32 shrink-0 truncate">{member.name ?? "Sem nome"}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={ratios[member.id] ?? 0}
                  onChange={(e) => handleChange(member.id, e.target.value)}
                  className="w-20"
                  disabled={isPending || isResetting}
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>

        {!isValid && (
          <p className="text-sm text-destructive">
            A soma das proporções deve ser 100% (atual: {total}%)
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!isValid || isPending || isResetting}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isPending || isResetting}
          >
            {isResetting ? "Resetando..." : "Resetar para igual"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
