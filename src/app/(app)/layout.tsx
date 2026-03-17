import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { MobileHeader } from "@/components/mobile-header";
import { requireAuth } from "@/lib/auth-guard";
import { materializeRecurring } from "@/lib/actions/recurring";
import { getGlobalBalance } from "@/lib/actions/dashboard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  let balance = 0;
  try {
    [, balance] = await Promise.all([materializeRecurring(), getGlobalBalance()]);
  } catch (error) {
    console.error("Failed to run background tasks:", error);
  }

  return (
    <SessionProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <MobileHeader
            userName={session.user.name}
            userEmail={session.user.email}
            balance={balance}
          />
          <Header userName={session.user.name} balance={balance} />
          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
