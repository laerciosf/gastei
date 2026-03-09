// Server-side auth guard for server actions and data fetching.
// Middleware (src/middleware.ts) handles route-level redirects.
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
