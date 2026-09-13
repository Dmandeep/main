import type { Role } from "@prisma/client";

/**
 * The permission model, in one place.
 *
 * Authorization was previously a scatter of `role === "ADMIN"` checks across
 * route handlers. That works until a role is added — and adding HOD is exactly
 * the case that breaks it, because HOD is *more* senior than faculty on paper
 * while having *fewer* rights in one specific respect.
 *
 * The separation that matters, from docs/design/CAMPUS-ECOSYSTEM.md:
 *
 *   HOD approves who someone is, and allocates scarce things.
 *   FACULTY verifies what someone did.
 *
 * Those are deliberately different people. If the person who grants a role can
 * also validate the work that role produces, there is no second pair of eyes
 * anywhere in the chain — a HOD could enrol a student, verify their evidence,
 * and award them a seat with nobody else involved. So `VERIFY_EVIDENCE` is the
 * one capability an HOD does not hold.
 */
export type Capability =
  /** Sign off evidence, moving the standing ledger. */
  | "VERIFY_EVIDENCE"
  /** Approve access requests and role changes. */
  | "APPROVE_MEMBERSHIP"
  /** Import a roster, edit memberships. */
  | "MANAGE_ROSTER"
  /** Override event seats, promote from the waitlist. */
  | "ALLOCATE_SEATS"
  /** Remove messages, mute members, resolve reports. */
  | "MODERATE"
  /** Post bounties and schedule events. */
  | "POST_OPPORTUNITY"
  /** Read department-wide reports and audit logs. */
  | "VIEW_REPORTS";

const MATRIX: Record<Role, readonly Capability[]> = {
  STUDENT: [],

  // Verifies work. Cannot grant anyone a role.
  FACULTY: ["VERIFY_EVIDENCE", "MODERATE", "POST_OPPORTUNITY", "ALLOCATE_SEATS", "VIEW_REPORTS"],

  // Approves people and allocates. Deliberately CANNOT verify evidence —
  // that is the four-eyes boundary.
  HOD: ["APPROVE_MEMBERSHIP", "MANAGE_ROSTER", "ALLOCATE_SEATS", "MODERATE", "POST_OPPORTUNITY", "VIEW_REPORTS"],

  // Operations. Runs the roster and the platform, and can verify, because on a
  // small pilot somebody has to be able to unblock a stalled queue.
  ADMIN: [
    "VERIFY_EVIDENCE",
    "APPROVE_MEMBERSHIP",
    "MANAGE_ROSTER",
    "ALLOCATE_SEATS",
    "MODERATE",
    "POST_OPPORTUNITY",
    "VIEW_REPORTS",
  ],

  MENTOR: ["POST_OPPORTUNITY"],
  ALUMNI: ["POST_OPPORTUNITY"],
};

export function can(role: Role, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

/** Every capability a role holds. Useful for shaping a UI without guessing. */
export function capabilitiesOf(role: Role): readonly Capability[] {
  return MATRIX[role];
}

/** Roles that hold a capability. Used to notify the right people. */
export function rolesWith(capability: Capability): Role[] {
  return (Object.keys(MATRIX) as Role[]).filter((r) => can(r, capability));
}

/**
 * Convenience predicates, so handlers read as intent rather than as a role list.
 */
export const canVerifyEvidence = (role: Role) => can(role, "VERIFY_EVIDENCE");
export const canApproveMembership = (role: Role) => can(role, "APPROVE_MEMBERSHIP");
export const canManageRoster = (role: Role) => can(role, "MANAGE_ROSTER");
export const canAllocateSeats = (role: Role) => can(role, "ALLOCATE_SEATS");
export const canModerate = (role: Role) => can(role, "MODERATE");
export const canPostOpportunity = (role: Role) => can(role, "POST_OPPORTUNITY");
export const canViewReports = (role: Role) => can(role, "VIEW_REPORTS");

/** Roles that reach the admin area at all. */
export function isStaff(role: Role): boolean {
  return capabilitiesOf(role).length > 0 && role !== "MENTOR" && role !== "ALUMNI";
}

/**
 * Staff roles as they appear in a session token, which carries them
 * lowercased.
 *
 * The edge proxy cannot import Prisma, so it needs the role names as plain
 * strings. Deriving them here rather than retyping `["faculty", "admin"]` in
 * proxy.ts is what stops the edge gate drifting from the matrix — it drifted
 * exactly that way when HOD was added, locking the HOD out of /admin.
 */
export const STAFF_SESSION_ROLES: readonly string[] = rolesWith("VIEW_REPORTS").map((r) =>
  r.toLowerCase()
);

/**
 * Capability check against a session role.
 *
 * Session tokens carry the role lowercased, and client components only ever
 * see that. Unknown or missing roles answer false — a UI that fails open
 * shows people buttons whose handlers will refuse them, which reads as a
 * broken product rather than a denied permission.
 *
 * This is for deciding what to render. It is never authorization: every
 * handler re-checks with the server-read membership.
 */
export function canSessionRole(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  const upper = role.toUpperCase() as Role;
  return upper in MATRIX && can(upper, capability);
}
