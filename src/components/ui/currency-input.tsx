"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function formatCentsToDisplay(cents: number): string {
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${formattedInt},${decPart}`;
}

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  name: string;
  defaultValueCents?: number;
}

function CurrencyInput({ name, defaultValueCents = 0, className, ...props }: CurrencyInputProps) {
  const [cents, setCents] = React.useState(defaultValueCents);

  React.useEffect(() => {
    setCents(defaultValueCents);
  }, [defaultValueCents]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setCents(Number(digits));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setCents((prev) => Math.floor(prev / 10));
    }
  }

  return (
    <>
      <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
      <input
        inputMode="numeric"
        data-slot="input"
        className={cn(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          className,
        )}
        value={formatCentsToDisplay(cents)}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        {...props}
      />
    </>
  );
}

export { CurrencyInput };
