import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileHeader } from "@/components/mobile-header";
import { requireAuth } from "@/lib/auth-guard";
import { getPendingInvites } from "@/lib/actions/household";
import { materializeRecurring } from "@/lib/actions/recurring";
import { cleanupExpiredInvites } from "@/lib/actions/household";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  const pendingInvites = session?.user ? await getPendingInvites() : [];
  const pendingInviteCount = pendingInvites.length;

  // Non-critical background tasks — failures must not crash the layout
  try {
    await Promise.all([
      materializeRecurring(),
      cleanupExpiredInvites(),
    ]);
  } catch (error) {
    console.error("Failed to run background tasks:", error);
  }

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <MobileHeader
            pendingInviteCount={pendingInviteCount}
            userName={session.user.name}
            userEmail={session.user.email}
          />
          <Header pendingInviteCount={pendingInviteCount} userName={session.user.name} />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
