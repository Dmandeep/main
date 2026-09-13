import { describe, expect, it } from "vitest";
import {
  canJoinDirectly,
  canModerate,
  canPost,
  canRead,
  isAwaitingApproval,
  needsApproval,
  type CommunityShape,
  type ViewerShape,
} from "./access";

/**
 * These rules decide who can see and say things on a campus network. A wrong
 * answer here is either a privacy failure or a student being silently unable
 * to speak, so both directions are pinned.
 */

function community(overrides: Partial<CommunityShape> = {}): CommunityShape {
  return { visibility: "CAMPUS", kind: "INTEREST", archivedAt: null, ...overrides };
}

function viewer(overrides: Partial<ViewerShape> = {}): ViewerShape {
  return { role: "STUDENT", membership: null, ...overrides };
}

const member = { role: "MEMBER" as const, status: "ACTIVE" as const, leftAt: null, mutedUntil: null };
const moderator = { role: "MODERATOR" as const, status: "ACTIVE" as const, leftAt: null, mutedUntil: null };

describe("canRead", () => {
  it("lets any student read an open community without joining", () => {
    // A channel nobody can see is a channel nobody joins.
    expect(canRead(community(), viewer()).allowed).toBe(true);
  });

  it("lets a student read a request-to-join community before joining", () => {
    expect(canRead(community({ visibility: "REQUEST_TO_JOIN" }), viewer()).allowed).toBe(true);
  });

  it("hides a private community from a non-member", () => {
    const r = canRead(community({ visibility: "PRIVATE" }), viewer());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("private");
  });

  it("lets a private community's member read it", () => {
    expect(canRead(community({ visibility: "PRIVATE" }), viewer({ membership: member })).allowed).toBe(true);
  });

  it("lets a project teammate read the project's private community", () => {
    // Being on the project is the membership; nobody should have to join twice.
    const r = canRead(
      community({ visibility: "PRIVATE", kind: "PROJECT" }),
      viewer({ isOnParentProject: true })
    );
    expect(r.allowed).toBe(true);
  });

  it("lets staff read anything, for moderation", () => {
    for (const role of ["ADMIN", "FACULTY"] as const) {
      expect(canRead(community({ visibility: "PRIVATE" }), viewer({ role })).allowed).toBe(true);
    }
  });

  it("does not let an alumni or mentor read a private community they are not in", () => {
    for (const role of ["ALUMNI", "MENTOR"] as const) {
      expect(canRead(community({ visibility: "PRIVATE" }), viewer({ role })).allowed).toBe(false);
    }
  });
});

describe("canPost", () => {
  it("requires membership even in an open community", () => {
    // Reading and speaking are separate: membership is what moderation acts on.
    const r = canPost(community(), viewer());
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("not_a_member");
  });

  it("lets a member post", () => {
    expect(canPost(community(), viewer({ membership: member })).allowed).toBe(true);
  });

  it("refuses a muted member and says so", () => {
    const muted = { ...member, mutedUntil: new Date(Date.now() + 60_000) };
    const r = canPost(community(), viewer({ membership: muted }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("muted");
  });

  it("lets a member post once the mute has expired", () => {
    const expired = { ...member, mutedUntil: new Date(Date.now() - 60_000) };
    expect(canPost(community(), viewer({ membership: expired })).allowed).toBe(true);
  });

  it("tells someone who left how to come back", () => {
    const left = { ...member, leftAt: new Date() };
    const r = canPost(community(), viewer({ membership: left }));
    expect(r.reason).toBe("left");
    expect(r.message).toMatch(/rejoin/i);
  });

  it("refuses everyone in an archived community, including staff", () => {
    const archived = community({ archivedAt: new Date() });
    expect(canPost(archived, viewer({ role: "ADMIN", membership: moderator })).allowed).toBe(false);
    expect(canPost(archived, viewer({ membership: member })).reason).toBe("archived");
  });

  it("makes staff join before speaking", () => {
    // Moderating does not require a voice, and an admin posting from nowhere
    // is confusing to the students in the room.
    expect(canPost(community(), viewer({ role: "ADMIN" })).allowed).toBe(false);
  });
});

describe("canModerate", () => {
  it("allows staff without community membership", () => {
    expect(canModerate(community(), viewer({ role: "FACULTY" })).allowed).toBe(true);
    expect(canModerate(community(), viewer({ role: "ADMIN" })).allowed).toBe(true);
  });

  it("allows the community's own owner and moderators", () => {
    expect(canModerate(community(), viewer({ membership: moderator })).allowed).toBe(true);
    expect(
      canModerate(community(), viewer({ membership: { ...member, role: "OWNER" } })).allowed
    ).toBe(true);
  });

  it("refuses an ordinary member", () => {
    const r = canModerate(community(), viewer({ membership: member }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("not_a_moderator");
  });

  it("refuses a moderator who has left", () => {
    const left = { ...moderator, leftAt: new Date() };
    expect(canModerate(community(), viewer({ membership: left })).allowed).toBe(false);
  });

  it("still allows moderation of an archived community", () => {
    // Archiving stops new messages; it must not strand existing reports.
    expect(
      canModerate(community({ archivedAt: new Date() }), viewer({ membership: moderator })).allowed
    ).toBe(true);
  });
});

describe("joining", () => {
  it("lets anyone join an open community directly", () => {
    expect(canJoinDirectly(community())).toBe(true);
  });

  it("does not allow direct joining where approval is required", () => {
    const c = community({ visibility: "REQUEST_TO_JOIN" });
    expect(canJoinDirectly(c)).toBe(false);
    expect(needsApproval(c)).toBe(true);
  });

  it("does not allow joining a private or archived community directly", () => {
    expect(canJoinDirectly(community({ visibility: "PRIVATE" }))).toBe(false);
    expect(canJoinDirectly(community({ archivedAt: new Date() }))).toBe(false);
  });
});

describe("every refusal explains itself", () => {
  it("never returns an empty message when denying", () => {
    const denials = [
      canRead(community({ visibility: "PRIVATE" }), viewer()),
      canPost(community(), viewer()),
      canPost(community({ archivedAt: new Date() }), viewer({ membership: member })),
      canPost(community(), viewer({ membership: { ...member, mutedUntil: new Date(Date.now() + 1000) } })),
      canModerate(community(), viewer({ membership: member })),
    ];

    for (const d of denials) {
      expect(d.allowed).toBe(false);
      expect(d.message.length).toBeGreaterThan(10);
    }
  });
});

describe("pending join requests", () => {
  const requestToJoin: CommunityShape = {
    visibility: "REQUEST_TO_JOIN",
    kind: "INTEREST",
    archivedAt: null,
  };

  const pending: ViewerShape = {
    role: "STUDENT",
    membership: { role: "MEMBER", status: "PENDING", leftAt: null, mutedUntil: null },
  };

  const approved: ViewerShape = {
    role: "STUDENT",
    membership: { role: "MEMBER", status: "ACTIVE", leftAt: null, mutedUntil: null },
  };

  it("does not let a pending member post", () => {
    // The entire point of request-to-join: asking is not joining.
    const decision = canPost(requestToJoin, pending);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("pending_approval");
  });

  it("tells them why, rather than saying they are not a member", () => {
    // "Join this community to post" to someone who already asked reads as the
    // request having been lost.
    expect(canPost(requestToJoin, pending).message).toMatch(/waiting/i);
  });

  it("lets an approved member post", () => {
    expect(canPost(requestToJoin, approved).allowed).toBe(true);
  });

  it("does not let a pending member moderate", () => {
    const owner: ViewerShape = {
      role: "STUDENT",
      membership: { role: "OWNER", status: "PENDING", leftAt: null, mutedUntil: null },
    };
    // Role and status are separate fields; holding OWNER while still pending
    // must not grant moderation.
    expect(canModerate(requestToJoin, owner).allowed).toBe(false);
  });

  it("keeps a pending member out of a private community", () => {
    const privateRoom: CommunityShape = {
      visibility: "PRIVATE",
      kind: "INTEREST",
      archivedAt: null,
    };
    expect(canRead(privateRoom, pending).allowed).toBe(false);
  });

  it("still reads a request-to-join community, which is how you decide to ask", () => {
    expect(canRead(requestToJoin, pending).allowed).toBe(true);
  });

  it("treats a missing status as active, so existing rows are unaffected", () => {
    const legacy: ViewerShape = {
      role: "STUDENT",
      membership: { role: "MEMBER", status: "ACTIVE", leftAt: null, mutedUntil: null },
    };
    expect(canPost(requestToJoin, legacy).allowed).toBe(true);
  });

  it("reports who is awaiting approval", () => {
    expect(isAwaitingApproval(pending)).toBe(true);
    expect(isAwaitingApproval(approved)).toBe(false);
    expect(isAwaitingApproval({ role: "STUDENT", membership: null })).toBe(false);
  });
});
