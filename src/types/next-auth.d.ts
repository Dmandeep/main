import type { DefaultSession } from "@auth/core/types";
import type { RankTier, UserRole } from "@/types";

/**
 * IdeaSpace attaches campus identity to the session, the provider `User`, and the JWT.
 * All three must be augmented — augmenting only `Session` is what forced the `any`
 * casts in `src/lib/auth.ts` and at every call site that read `session.user.role`.
 *
 * The augmented modules are `@auth/core/*`, not `next-auth/*`: `next-auth` only
 * re-exports these types (`node_modules/next-auth/index.d.ts` line 78), so declaring
 * them on `next-auth` creates a second, unused module instead of merging.
 */
interface IdeaSpaceIdentity {
  role: UserRole;
  username: string;
  isOnboarded: boolean;
  rankTier: RankTier;
  points: number;
}

declare module "@auth/core/types" {
  interface Session {
    user: { id: string } & IdeaSpaceIdentity & DefaultSession["user"];
  }

  /** Returned by `authorize()` and by the OAuth providers. */
  interface User extends Partial<IdeaSpaceIdentity> {
    id?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT extends IdeaSpaceIdentity {
    id: string;
    /** Epoch ms of the last role/standing re-read. See TOKEN_REFRESH_MS. */
    refreshedAt?: number;
  }
}
