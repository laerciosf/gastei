"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { toggleOccurrencePaid } from "@/lib/actions/recurring";
import { toast } from "sonner";

export function OccurrenceCheckButton({ occurrenceId, paid }: { occurrenceId: string; paid: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const result = await toggleOccurrencePaid(occurrenceId);
    if (result.error) {
      toast.error(result.error);
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
        paid
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-muted-foreground/30 hover:border-muted-foreground/60"
      } ${loading ? "opacity-50" : ""}`}
    >
      {paid && <Check className="h-3 w-3" />}
    </button>
  );
}
