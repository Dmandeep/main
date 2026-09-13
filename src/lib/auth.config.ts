import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the NextAuth configuration.
 *
 * `src/proxy.ts` runs on the edge runtime, where a database driver cannot run
 * at all. Importing the full config there dragged the auth adapter and its
 * database client into the edge bundle, and that client threw at module scope
 * when its connection string was unset — so every request 500'd before any
 * handler ran.
 *
 * This file holds only what middleware needs: the JWT/session callbacks that
 * read an already-signed token, and the page routes. No adapter, no database
 * driver, no providers that touch one. `src/lib/auth.ts` spreads this and adds
 * the Node-only parts.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.username = token.username;
        session.user.isOnboarded = token.isOnboarded;
        session.user.rankTier = token.rankTier;
        session.user.points = token.points;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
