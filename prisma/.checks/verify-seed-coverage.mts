import { PrismaClient } from "@prisma/client";

/**
 * Can the demo data demonstrate the product?
 *
 * Three separate features were built correctly this month and looked broken
 * because the seed could not exercise them:
 *
 *   - Every project asked for "TypeScript" or "Postgres" while students tagged
 *     themselves "backend" and "ml", so skill matching always returned zero.
 *   - No community used REQUEST_TO_JOIN, so the whole request-and-approve path
 *     had no demo coverage and sat half-built.
 *   - The seed created no notifications at all, so that page was empty on
 *     every fresh install.
 *
 * None of those were code bugs and none would ever fail a unit test or the
 * HTTP audit. They are a category of their own: a surface that cannot show
 * itself reads as broken, and someone has to notice by hand.
 *
 * This check is that someone. Each assertion names the surface it protects and
 * the failure it would have caught.
 */

const prisma = new PrismaClient();

let failures = 0;

function check(surface: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${surface.padEnd(24)} ${detail}`);
  if (!ok) failures++;
}

const tenant = await prisma.tenant.findFirstOrThrow({ select: { id: true } });
const where = { tenantId: tenant.id };

// ---- Feed: needs every kind, or the mixed feed is a single-kind list ------
const [posts, projects, events, bounties] = await Promise.all([
  prisma.post.count({ where: { ...where, removedAt: null } }),
  prisma.project.count({ where: { ...where, status: { notIn: ["DRAFT", "REJECTED"] } } }),
  prisma.campusEvent.count({ where }),
  prisma.bounty.count({ where: { ...where, status: "OPEN" } }),
]);
check("feed: posts", posts > 0, `${posts}`);
check("feed: projects", projects > 0, `${projects}`);
check("feed: events", events > 0, `${events}`);
check("feed: open bounties", bounties > 0, `${bounties}`);

// ---- Evidence ranking: the feed's central claim needs verified work ------
const withEvidence = await prisma.project.count({
  where: { ...where, verifiedEvidenceCount: { gt: 0 } },
});
check(
  "feed: verified work",
  withEvidence > 0,
  `${withEvidence} project(s) with a non-zero counter`
);

// ---- Skill matching: the two vocabularies must actually overlap ----------
const tagLabels = new Set(
  (await prisma.profileTag.findMany({ where: { source: "SELF" }, select: { label: true } })).map(
    (t) => t.label.toLowerCase().trim()
  )
);
const needed = new Set(
  (await prisma.project.findMany({ where, select: { skillsNeeded: true } }))
    .flatMap((p) => p.skillsNeeded)
    .map((s) => s.toLowerCase().trim())
);
const overlap = [...needed].filter((s) => tagLabels.has(s));
check(
  "pulse: skill overlap",
  overlap.length > 0,
  overlap.length > 0
    ? `${overlap.length} shared: ${overlap.slice(0, 4).join(", ")}`
    : `no shared vocabulary — tags [${[...tagLabels].slice(0, 4)}] vs needs [${[...needed].slice(0, 4)}]`
);

// ---- Request to join: needs a community that actually requires approval ---
const requestToJoin = await prisma.community.count({
  where: { ...where, visibility: "REQUEST_TO_JOIN", archivedAt: null },
});
check("communities: ask to join", requestToJoin > 0, `${requestToJoin}`);

const moderated = await prisma.communityMember.count({
  where: { role: { in: ["OWNER", "MODERATOR"] }, status: "ACTIVE" },
});
check("communities: moderators", moderated > 0, `${moderated}`);

// ---- Notifications -------------------------------------------------------
const notifications = await prisma.notification.count({ where });
const unread = await prisma.notification.count({ where: { ...where, isRead: false } });
check("notifications: seeded", notifications > 0, `${notifications}`);
check("notifications: some unread", unread > 0, `${unread} unread`);

// ---- Events: allocation needs a full event with a waitlist ---------------
const waitlisted = await prisma.eventRegistration.count({ where: { status: "WAITLISTED" } });
check("events: waitlist", waitlisted > 0, `${waitlisted} waiting`);

const quotaSeats = await prisma.eventRegistration.count({
  where: { allocation: "NEWCOMER_QUOTA" },
});
check("events: newcomer quota used", quotaSeats > 0, `${quotaSeats} reserved seat(s) taken`);

// ---- Archive: revival is the point, so something must be archived --------
const archived = await prisma.project.count({ where: { ...where, status: "ARCHIVED" } });
check("archive: postmortems", archived > 0, `${archived}`);

// ---- Review bench: faculty need something in the queue -------------------
const pendingReview = await prisma.evidence.count({
  where: { state: { in: ["SUBMITTED", "UNDER_REVIEW", "MACHINE_VERIFIED"] } },
});
check("review: queue not empty", pendingReview > 0, `${pendingReview} awaiting`);

// ---- Roles: the four-eyes story needs all four to exist ------------------
for (const role of ["STUDENT", "FACULTY", "HOD", "ADMIN"] as const) {
  const n = await prisma.membership.count({ where: { ...where, role } });
  check(`roles: ${role.toLowerCase()}`, n > 0, `${n}`);
}

// ---- Newcomers: the quota and "just starting" views need zero-point people
const zeroPoint = await prisma.standing.count({ where: { points: 0 } });
check("standing: newcomers", zeroPoint > 0, `${zeroPoint} on zero`);

// ---- Profiles: pills and the verified/claimed distinction ----------------
const links = await prisma.profileLink.count();
const verifiedLinks = await prisma.profileLink.count({ where: { isVerified: true } });
check("profiles: links", links > 0, `${links}`);
check(
  "profiles: a verified one",
  verifiedLinks > 0,
  `${verifiedLinks} — needed to show proven vs claimed side by side`
);

console.log(
  `\n${failures === 0 ? "every surface can demonstrate itself" : `${failures} surface(s) cannot demonstrate themselves`}`
);

await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
