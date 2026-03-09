import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  pendingInviteCount: number;
  userName?: string | null;
}

export function Header({ pendingInviteCount, userName }: HeaderProps) {
  const initials = userName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "?";

  return (
    <header className="hidden h-14 items-center justify-end border-b px-6 lg:flex">
      <div className="flex items-center gap-4">
        {pendingInviteCount > 0 && (
          <Link href="/household" className="relative">
            <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {pendingInviteCount}
            </span>
          </Link>
        )}
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
