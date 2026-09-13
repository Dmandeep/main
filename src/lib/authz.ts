import type { Session } from "next-auth";
import type { UserRole } from "@/types";

/**
 * Role check for route handlers.
 *
 * Takes the whole session so an unauthenticated request and a request from a
 * signed-in user without the role collapse to the same `false`, rather than
 * relying on `["admin"].includes(undefined)` happening to be falsy.
 */
export function hasRole(
  session: Session | null,
  ...roles: UserRole[]
): session is Session {
  const role = session?.user?.role;
  return role !== undefined && roles.includes(role);
}
