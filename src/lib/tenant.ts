import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface ActiveMembership {
  membershipId: string;
  tenantId: string;
  userId: string;
  role: Role;
  department: string | null;
  year: number | null;
}

/**
 * Resolve the caller's tenant and role.
 *
 * Every read and write in this application must be scoped by `tenantId`. Route
 * middleware is not enough: middleware sees a path, not a row, and a handler
 * that forgets the scope leaks another department's records with no error.
 * So the scope comes from here, and handlers take it as a parameter.
 *
 * `cache` dedupes this within a single request, so a handler can call it
 * without worrying about repeat queries.
 */
export const getActiveMembership = cache(
  async (): Promise<ActiveMembership | null> => {
    const session = await auth();
    if (!session?.user?.id) return null;

    // Pilot scope is a single department, so the first ACTIVE membership is
    // the right one. When a user can belong to several tenants, this reads a
    // selected tenant from the session instead.
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        role: true,
        department: true,
        year: true,
      },
      orderBy: { joinedAt: "asc" },
    });

    if (!membership) return null;

    return {
      membershipId: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.role,
      department: membership.department,
      year: membership.year,
    };
  }
);

// Authorization lives in src/lib/authz/permissions.ts. The `canReview` helper
// that used to sit here was gating four unrelated things — verification,
// membership approval, roster import and seat allocation — behind one role
// list, which is what made adding HOD impossible without breaking four-eyes.

/**
 * The current season for a tenant. Standing is seasonal so that final-year
 * students do not permanently outrank everyone below them.
 */
export const getCurrentSeason = cache(async (tenantId: string) => {
  return prisma.season.findFirst({
    where: { tenantId, isCurrent: true },
    select: { id: true, name: true, startsAt: true, endsAt: true },
  });
});

/**
 * The public-facing shape of a person. Used everywhere a project, evidence row
 * or ledger line names someone, so the selection stays consistent and no
 * handler accidentally serialises a password hash.
 */
export const userRefSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const;
