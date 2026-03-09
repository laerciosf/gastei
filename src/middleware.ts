// Middleware handles route-level auth (redirect unauthenticated users).
// For server action/data auth, see src/lib/auth-guard.ts (throws on missing session).
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
