import type {
  CommunityKind,
  CommunityMemberStatus,
  CommunityRole,
  CommunityVisibility,
  Role,
} from "@prisma/client";
import { canModerate as roleCanModerate } from "@/lib/authz/permissions";

/**
 * Who may read, post in, and moderate a community.
 *
 * Pure functions with no imports beyond types, so the rules that decide who
 * can see a conversation are testable without a database and readable by
 * someone reviewing a moderation decision.
 *
 * The product has no direct messages at all. Every conversation happens in a
 * community with at least one moderator and an audit trail — most campus
 * harassment happens in private channels, and removing the surface removes the
 * problem class rather than policing it.
 */

export interface CommunityShape {
  visibility: CommunityVisibility;
  kind: CommunityKind;
  archivedAt: Date | null;
}

export interface ViewerShape {
  /** Campus role. Admins moderate; they are not automatically members. */
  role: Role;
  /** Null when the viewer has never joined. */
  membership: {
    role: CommunityRole;
    /**
     * PENDING means a request is in, not that they are in.
     *
     * Required, not optional. It was optional at first with "missing means
     * active" as a convenience for old rows — and that default is exactly how
     * a pending member got to post: one handler selected the membership
     * without this column, the status arrived undefined, and the guard waved
     * them through. Making it required turns that into a compile error at
     * every call site instead of a silent bypass at one.
     */
    status: CommunityMemberStatus;
    leftAt: Date | null;
    mutedUntil: Date | null;
  } | null;
  /** True when the viewer is on the project a PROJECT community belongs to. */
  isOnParentProject?: boolean;
}

export type DenyReason =
  | "pending_approval"
  | "not_a_member"
  | "private"
  | "archived"
  | "muted"
  | "left"
  | "not_a_moderator";

export interface AccessDecision {
  allowed: boolean;
  reason: DenyReason | null;
  message: string;
}

const ALLOW: AccessDecision = { allowed: true, reason: null, message: "" };

function deny(reason: DenyReason, message: string): AccessDecision {
  return { allowed: false, reason, message };
}

/** Staff who may always moderate, regardless of community membership. */
function isStaff(role: Role): boolean {
  return roleCanModerate(role);
}

/**
 * A membership that actually counts.
 *
 * A PENDING row means the person has asked to join, not that they have. It is
 * deliberately checked here, in the one place every rule already goes through,
 * rather than at each call site — a pending member who could post because one
 * handler forgot the check is the whole failure mode this guards.
 */
function activeMembership(viewer: ViewerShape) {
  const m = viewer.membership;
  if (!m || m.leftAt) return null;
  if (m.status === "PENDING") return null;
  return m;
}

/** Has the viewer asked to join and not yet been answered? */
export function isAwaitingApproval(viewer: ViewerShape): boolean {
  const m = viewer.membership;
  return Boolean(m && !m.leftAt && m.status === "PENDING");
}

/**
 * Can the viewer read the conversation?
 *
 * CAMPUS and REQUEST_TO_JOIN communities are readable by anyone in the
 * department — a channel nobody can see is a channel nobody joins. PRIVATE
 * requires membership.
 */
export function canRead(community: CommunityShape, viewer: ViewerShape): AccessDecision {
  if (isStaff(viewer.role)) return ALLOW;

  if (community.visibility === "PRIVATE") {
    if (activeMembership(viewer)) return ALLOW;
    if (community.kind === "PROJECT" && viewer.isOnParentProject) return ALLOW;
    return deny("private", "This community is private to its members.");
  }

  return ALLOW;
}

/**
 * Can the viewer post?
 *
 * Reading and posting are separate on purpose: a student can look before
 * joining, but speaking requires membership, which is what gives moderation
 * something to act on.
 */
export function canPost(community: CommunityShape, viewer: ViewerShape): AccessDecision {
  if (community.archivedAt) {
    return deny("archived", "This community is archived. It stays readable, but nobody can post.");
  }

  const membership = activeMembership(viewer);

  if (!membership) {
    if (isAwaitingApproval(viewer)) {
      return deny(
        "pending_approval",
        "Your request to join is waiting for a moderator."
      );
    }
    if (viewer.membership?.leftAt) {
      return deny("left", "You left this community. Rejoin to post.");
    }
    // Staff still have to join before speaking — an admin posting from nowhere
    // is confusing, and moderation does not require a voice.
    return deny("not_a_member", "Join this community to post.");
  }

  if (membership.mutedUntil && membership.mutedUntil > new Date()) {
    return deny("muted", "You are muted in this community.");
  }

  return ALLOW;
}

/** Can the viewer remove messages and mute people? */
export function canModerate(community: CommunityShape, viewer: ViewerShape): AccessDecision {
  if (isStaff(viewer.role)) return ALLOW;

  const membership = activeMembership(viewer);
  if (membership && (membership.role === "OWNER" || membership.role === "MODERATOR")) {
    return ALLOW;
  }

  return deny("not_a_moderator", "Only moderators can do that.");
}

/**
 * Can the viewer join without asking?
 *
 * System-managed communities (batch, project, event) are joined by belonging
 * to the thing, not by clicking — so this only answers for the open kinds.
 */
export function canJoinDirectly(community: CommunityShape): boolean {
  return community.visibility === "CAMPUS" && !community.archivedAt;
}

/** Whether a join needs a moderator's approval. */
export function needsApproval(community: CommunityShape): boolean {
  return community.visibility === "REQUEST_TO_JOIN";
}
