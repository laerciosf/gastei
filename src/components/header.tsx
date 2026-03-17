import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BalanceCard } from "@/components/balance-card";

interface HeaderProps {
  userName?: string | null;
  balance: number;
}

export function Header({ userName, balance }: HeaderProps) {
  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <header className="hidden h-14 items-center justify-between border-b px-6 lg:flex">
      <BalanceCard balance={balance} />
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{userName}</span>
        </div>
      </div>
    </header>
  );
}
