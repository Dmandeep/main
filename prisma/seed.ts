/**
 * Seeds one department's worth of plausible data.
 *
 * The point is not volume — it is shape. A ledger UI reviewed against an empty
 * table or against uniformly-perfect rows teaches you nothing. This seed
 * deliberately produces the awkward cases:
 *   - students with zero standing (the freshman-lockout problem)
 *   - evidence stuck in review past the SLA
 *   - a rejected submission with a rationale
 *   - an archived project with a postmortem, and a revival that inherits it
 *   - a reputation event that was reversed for abuse
 *   - a bounty reserved for newcomers
 *   - an event that is oversubscribed, so the quota actually bites
 */
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { POINTS, tierFor } from "../src/lib/standing/rules";
import { reconcileEvidenceCounts } from "../src/lib/projects/reconcile";
import { assertLocalDatabase } from "./seed-guard";

const prisma = new PrismaClient();

/**
 * Dev sign-in only. The guard checks where the database actually is, not
 * NODE_ENV — see prisma/seed-guard.ts for why that distinction matters.
 */
const DEV_PASSWORD = "ideaspace-dev-password";
assertLocalDatabase();

const TRACKS = [
  "ai-intelligent-systems",
  "software-saas-platform",
  "data-analytics",
  "cybersecurity-cloud",
  "embedded-iot-robotics",
  "ux-product-design",
];

/** Deterministic pseudo-random so reseeding produces a comparable database. */
let seedState = 42;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)]!;
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86400000);
}

const FIRST = ["Harshith", "Ananya", "Rohit", "Sneha", "Karthik", "Divya", "Arjun", "Meera",
  "Pavan", "Lakshmi", "Sai", "Nithya", "Vamsi", "Keerthi", "Ravi", "Swathi",
  "Naveen", "Priya", "Manoj", "Bhavana", "Kiran", "Deepika", "Suresh", "Anjali"];
const LAST = ["Varma", "Reddy", "Naidu", "Rao", "Patnaik", "Sharma", "Kumar", "Prasad",
  "Chowdary", "Menon", "Iyer", "Das"];

async function main() {
  console.log("Resetting seed data…");
  // Order matters: children before parents.
  try {
    await prisma.$transaction([
      prisma.session.deleteMany(),
      prisma.account.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.vote.deleteMany(),
      prisma.eventDemandVote.deleteMany(),
      prisma.eventRegistration.deleteMany(),
      prisma.joinRequest.deleteMany(),
      prisma.verificationReview.deleteMany(),
      prisma.evidence.deleteMany(),
      prisma.bountySubmission.deleteMany(),
      prisma.bounty.deleteMany(),
      prisma.milestone.deleteMany(),
      prisma.projectMembership.deleteMany(),
      prisma.standing.deleteMany(),
      prisma.reputationEvent.deleteMany(),
      prisma.project.deleteMany(),
      prisma.campusEvent.deleteMany(),
      prisma.season.deleteMany(),
      prisma.membership.deleteMany(),
      prisma.tenant.deleteMany(),
      prisma.institution.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } catch (e) {
    console.log("Ignored reset error (fresh DB)");
  }

  const devPassword = await bcrypt.hash(DEV_PASSWORD, 10);

  const institution = await prisma.institution.create({
    data: {
      name: "Lendi Institute of Engineering and Technology",
      domains: ["lendi.org", "lendi.edu.in"],
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      institutionId: institution.id,
      name: "Computer Science & Engineering",
      slug: "cse",
      status: "PILOT",
      settings: {
        verificationSlaHours: 72,
        newcomerQuotaPercent: 40,
        randomAuditRate: 0.05,
      },
    },
  });

  const season = await prisma.season.create({
    data: {
      tenantId: tenant.id,
      name: "2026 Odd Semester",
      startsAt: daysAgo(75),
      endsAt: new Date(Date.now() + 45 * 86400000),
      isCurrent: true,
    },
  });

  /**
   * What teams are short of.
   *
   * Shares a vocabulary with the self-tags seeded in seed-communities.ts. If
   * these two lists drift apart, the matching on /api/pulse silently returns
   * nothing and the feature looks broken rather than empty.
   */
  const SKILLS_NEEDED: string[][] = [
    ["backend", "Postgres"],
    ["ui", "design"],
    ["ml", "data"],
    ["embedded"],
    ["security", "backend"],
    ["design"],
    ["data", "TypeScript"],
    ["backend", "ui", "data"],
  ];

  // ── People ────────────────────────────────────────────────
  console.log("Creating people…");

  const rao = await prisma.user.create({
    data: {
      email: "a.rao@lendi.org",
      name: "Dr. A. Rao",
      username: "arao",
      bio: "Associate Professor, CSE. Department administrator on IdeaSpace.",
      passwordHash: devPassword,
      memberships: {
        create: { tenantId: tenant.id, role: "ADMIN", department: "CSE" },
      },
    },
  });

  // The HOD approves people and allocates seats, and deliberately cannot
  // verify evidence. Seeding them as ADMIN — as this file used to — hides the
  // separation the whole authorization model exists to enforce.
  const hod = await prisma.user.create({
    data: {
      email: "hod.cse@lendi.org",
      name: "Prof. S. Patnaik",
      username: "spatnaik",
      bio: "Head of Department, CSE.",
      passwordHash: devPassword,
      memberships: {
        create: { tenantId: tenant.id, role: "HOD", department: "CSE" },
      },
    },
  });

  // The other half of four-eyes: faculty verify work but cannot enrol people.
  const faculty = await prisma.user.create({
    data: {
      email: "k.suneetha@lendi.org",
      name: "Dr. K. Suneetha",
      username: "ksuneetha",
      bio: "Assistant Professor, CSE. Verifies project evidence.",
      passwordHash: devPassword,
      memberships: {
        create: { tenantId: tenant.id, role: "FACULTY", department: "CSE" },
      },
    },
  });

  const alumni = await prisma.user.create({
    data: {
      email: "vikram.alum@lendi.org",
      name: "Vikram Chowdary",
      username: "vikramc",
      bio: "CSE 2022. Backend engineer. Mentoring on distributed systems.",
      githubUsername: "vikramc",
      githubVerified: true,
      memberships: {
        create: { tenantId: tenant.id, role: "ALUMNI", department: "CSE", status: "GRADUATED" },
      },
      mentorOffers: {
        create: { topic: "Distributed systems and backend design", hoursOffered: 4 },
      },
    },
  });

  // 24 students across years 1-4. Year 1 deliberately has no history at all —
  // that population is what the newcomer quota exists for.
  const students: { id: string; membershipId: string; year: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const first = FIRST[i % FIRST.length]!;
    const last = pick(LAST);
    const year = i < 6 ? 1 : i < 12 ? 2 : i < 19 ? 3 : 4;
    const username = `${first.toLowerCase()}${i}`;

    const u = await prisma.user.create({
      data: {
        email: `${username}@lendi.edu.in`,
        name: `${first} ${last}`,
        username,
        passwordHash: devPassword,
        githubUsername: year > 1 ? username : null,
        githubVerified: year > 2,
        memberships: {
          create: { tenantId: tenant.id, role: "STUDENT", department: "CSE", year },
        },
      },
      include: { memberships: true },
    });
    students.push({ id: u.id, membershipId: u.memberships[0]!.id, year });
  }

  // ── Projects ──────────────────────────────────────────────
  console.log("Creating projects…");

  const PROJECT_SEEDS = [
    ["Campus Mess Demand Forecaster", "Mess food waste runs 20-30% because headcount is guessed the night before.", "Forecast attendance from timetable, weather and past swipe data; publish a daily number the mess staff actually use.", "data-analytics", "SHIPPED"],
    ["Lab Equipment Booking", "Oscilloscope bookings live in a paper register in Lab 3. Double-bookings every week.", "QR on each instrument, slot booking, and a no-show penalty that decays.", "software-saas-platform", "BUILDING"],
    ["Attendance from Classroom Camera", "Roll call eats 6 minutes of a 50 minute period.", "On-device face grouping, faculty confirms a list rather than reading names.", "ai-intelligent-systems", "BUILDING"],
    ["Placement Prep Question Bank", "Every batch rebuilds the same DSA sheet from scratch and loses it at graduation.", "Versioned question bank with company tags and per-question difficulty from real attempt data.", "software-saas-platform", "DISCOVERY"],
    ["Hostel Water Tank Monitor", "Tanks run dry with no warning; the pump is switched on by whoever notices.", "Ultrasonic sensor, ESP32, a dashboard and an SMS trigger at 20%.", "embedded-iot-robotics", "SHIPPED"],
    ["Campus Lost and Found", "Lost items are posted to four different WhatsApp groups and found by nobody.", "One board, photo match, claim flow with a verification question.", "software-saas-platform", "ARCHIVED"],
    ["Exam Seating Allocator", "Seating charts are made by hand and take two days per exam cycle.", "Constraint solver honouring branch separation and accessibility needs.", "ai-intelligent-systems", "DISCOVERY"],
    ["Department Alumni Graph", "Nobody knows which alumnus works where until someone asks on LinkedIn.", "Opt-in alumni directory with verified employer and a mentorship availability flag.", "software-saas-platform", "BUILDING"],
    ["Phishing Drill Platform", "Students click every link in their inbox. No baseline, no training.", "Consented simulated phishing with a debrief, run per semester.", "cybersecurity-cloud", "DISCOVERY"],
    ["Accessible Campus Map", "No wheelchair route information exists for the campus.", "Crowd-sourced accessibility map with ramp, lift and surface data.", "ux-product-design", "BUILDING"],
  ] as const;

  const projects = [];
  for (let i = 0; i < PROJECT_SEEDS.length; i++) {
    const [title, problem, solution, track, status] = PROJECT_SEEDS[i]!;
    const owner = students[(i * 3 + 5) % students.length]!;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const p = await prisma.project.create({
      data: {
        tenantId: tenant.id,
        ownerId: owner.id,
        slug,
        title,
        tagline: null,
        problem,
        solution,
        track,
        tags: [track.split("-")[0]!, "campus"],
        // Drawn from the same vocabulary students tag themselves with, so
        // "teams looking for what you do" has something to find. Every project
        // previously asked for TypeScript or Postgres and nothing else, while
        // students tag themselves backend/ui/ml/embedded — two vocabularies
        // that could never meet.
        skillsNeeded: SKILLS_NEEDED[i % SKILLS_NEEDED.length]!,
        status: status as Prisma.ProjectCreateInput["status"],
        githubUrl: i % 3 === 0 ? `https://github.com/lendi-cse/${slug}` : null,
        demoUrl: status === "SHIPPED" ? `https://${slug}.vercel.app` : null,
        briefCompleteness: 55 + ((i * 7) % 45),
        createdAt: daysAgo(70 - i * 5),
        archivedAt: status === "ARCHIVED" ? daysAgo(20) : null,
        postmortem:
          status === "ARCHIVED"
            ? "Two of three members went on internship in week 6. The claim-verification flow was never built, so the board filled with unverifiable posts and students stopped trusting it. The photo-matching code is worth keeping; the claim flow needs rethinking before anyone restarts this."
            : null,
        outcome: status === "ARCHIVED" ? "PAUSED" : status === "SHIPPED" ? "SHIPPED" : null,
        members: {
          create: [
            { userId: owner.id, role: "Owner", joinedAt: daysAgo(70 - i * 5) },
            { userId: students[(i * 5 + 2) % students.length]!.id, role: "Engineer", joinedAt: daysAgo(60 - i * 4) },
          ],
        },
        milestones: {
          create: [
            { ordinal: 1, title: "Problem validated with 10 users", completedAt: daysAgo(50) },
            { ordinal: 2, title: "Working prototype", completedAt: status === "DISCOVERY" ? null : daysAgo(30) },
            { ordinal: 3, title: "Deployed and in use", completedAt: status === "SHIPPED" ? daysAgo(10) : null },
          ],
        },
      },
      include: { members: true, milestones: true },
    });
    projects.push(p);
  }

  // The revival: a new team inherits the archived project's record.
  const archived = projects.find((p) => p.status === "ARCHIVED")!;
  const reviver = students[2]!;
  await prisma.project.create({
    data: {
      tenantId: tenant.id,
      ownerId: reviver.id,
      slug: "campus-lost-and-found-v2",
      title: "Campus Lost and Found (revived)",
      problem: archived.problem,
      solution: "Restarting from the archived photo-matching code. Replacing the claim flow with a challenge question set by the finder.",
      track: "software-saas-platform",
      tags: ["campus"],
      skillsNeeded: ["TypeScript"],
      status: "BUILDING",
      briefCompleteness: 78,
      revivedFromId: archived.id,
      createdAt: daysAgo(12),
      members: { create: [{ userId: reviver.id, role: "Owner" }] },
    },
  });

  // ── Evidence and review ───────────────────────────────────
  console.log("Creating evidence…");

  type AwardSpec = { userId: string; type: keyof typeof POINTS; sourceType: string; sourceId: string; at: Date };
  const awards: AwardSpec[] = [];

  let evidenceCount = 0;
  for (const project of projects) {
    if (project.status === "DISCOVERY") continue; // nothing shipped yet, so nothing to show
    const members = project.members;
    const n = project.status === "SHIPPED" ? 6 : 3;

    for (let i = 0; i < n; i++) {
      const member = members[i % members.length]!;
      const sourceType = i % 3 === 0 ? "GITHUB_PR" : i % 3 === 1 ? "GITHUB_COMMIT" : "DEPLOYED_URL";
      const externalId = `${project.slug}-${sourceType}-${i}`;
      const createdAt = daysAgo(45 - i * 6);

      // Deliberate spread of states: most verified, one stale in review, one rejected.
      const isLast = i === n - 1;
      const state = isLast && project.status !== "SHIPPED"
        ? "UNDER_REVIEW"
        : i === 1 && project.slug.startsWith("attendance")
          ? "REJECTED"
          : "VERIFIED";

      const ev = await prisma.evidence.create({
        data: {
          projectId: project.id,
          creatorId: member.userId,
          milestoneId: null,
          title:
            sourceType === "GITHUB_PR" ? `PR #${120 + i * 7} merged`
            : sourceType === "GITHUB_COMMIT" ? `${6 + i} commits on main`
            : "Deployment live",
          sourceType: sourceType as Prisma.EvidenceCreateInput["sourceType"],
          sourceUrl:
            sourceType === "DEPLOYED_URL"
              ? `https://${project.slug}.vercel.app`
              : `https://github.com/lendi-cse/${project.slug}/pull/${120 + i * 7}`,
          sourceExternalId: externalId,
          producedAt: createdAt,
          capturedAt: createdAt,
          contentHash: `sha256:${externalId.padEnd(48, "0").slice(0, 48)}`,
          parserVersion: "1",
          extractionConfidence: state === "VERIFIED" ? 0.72 + rand() * 0.27 : 0.35 + rand() * 0.2,
          state: state as Prisma.EvidenceCreateInput["state"],
          createdAt,
        },
      });
      evidenceCount++;

      if (state === "VERIFIED" || state === "REJECTED") {
        await prisma.verificationReview.create({
          data: {
            evidenceId: ev.id,
            reviewerId: rand() > 0.3 ? faculty.id : rao.id,
            decision: state === "VERIFIED" ? "APPROVED" : "REJECTED",
            confidence: state === "VERIFIED" ? 0.9 : 0.8,
            rationale:
              state === "REJECTED"
                ? "The linked commit only changes the README. Resubmit with the commit that contains the detection code, or link the PR that merged it."
                : null,
            decidedAt: new Date(createdAt.getTime() + 2 * 86400000),
          },
        });
        if (state === "VERIFIED") {
          awards.push({
            userId: member.userId,
            type: "EVIDENCE_VERIFIED",
            sourceType: "evidence",
            sourceId: ev.id,
            at: new Date(createdAt.getTime() + 2 * 86400000),
          });
        }
      }
    }

    for (const m of project.milestones.filter((x) => x.completedAt)) {
      awards.push({
        userId: project.ownerId,
        type: "MILESTONE_COMPLETED",
        sourceType: "milestone",
        sourceId: m.id,
        at: m.completedAt!,
      });
    }
    if (project.status === "SHIPPED") {
      awards.push({
        userId: project.ownerId,
        type: "PROJECT_SHIPPED",
        sourceType: "project",
        sourceId: project.id,
        at: daysAgo(10),
      });
    }
  }

  // ── Standing ──────────────────────────────────────────────
  console.log("Writing the reputation ledger…");

  for (const a of awards) {
    await prisma.reputationEvent.create({
      data: {
        tenantId: tenant.id,
        userId: a.userId,
        seasonId: season.id,
        type: a.type as Prisma.ReputationEventCreateInput["type"],
        points: POINTS[a.type],
        sourceType: a.sourceType,
        sourceId: a.sourceId,
        idempotencyKey: `${a.type}:${a.sourceType}:${a.sourceId}:${a.userId}`,
        createdAt: a.at,
      },
    });
  }

  // One reversal, so the UI has to render a struck-through award and its reason.
  const toReverse = await prisma.reputationEvent.findFirst({
    where: { tenantId: tenant.id, type: "EVIDENCE_VERIFIED" },
    orderBy: { createdAt: "asc" },
  });
  if (toReverse) {
    const reversal = await prisma.reputationEvent.create({
      data: {
        tenantId: tenant.id,
        userId: toReverse.userId,
        seasonId: season.id,
        type: "ABUSE_REVERSAL",
        points: -toReverse.points,
        sourceType: "reputation_event",
        sourceId: toReverse.id,
        idempotencyKey: `ABUSE_REVERSAL:reputation_event:${toReverse.id}:${toReverse.userId}`,
        note: "Random audit: the linked PR was authored by a different student. Award reversed, no penalty applied.",
      },
    });
    await prisma.reputationEvent.update({
      where: { id: toReverse.id },
      data: { reversedById: reversal.id },
    });
  }

  // Materialize balances from the ledger — never by incrementing.
  for (const s of students) {
    const total = await prisma.reputationEvent.aggregate({
      where: { tenantId: tenant.id, userId: s.id, seasonId: season.id },
      _sum: { points: true },
    });
    const points = total._sum.points ?? 0;
    const verified = await prisma.evidence.count({
      where: { creatorId: s.id, state: "VERIFIED" },
    });
    await prisma.standing.create({
      data: {
        membershipId: s.membershipId,
        seasonId: season.id,
        points,
        tier: tierFor(points),
        verifiedEvidenceCount: verified,
      },
    });
  }

  const ranked = await prisma.standing.findMany({
    where: { seasonId: season.id },
    orderBy: { points: "desc" },
  });
  for (let i = 0; i < ranked.length; i++) {
    await prisma.standing.update({ where: { id: ranked[i]!.id }, data: { rank: i + 1 } });
  }

  // ── Bounties ──────────────────────────────────────────────
  console.log("Creating bounties…");

  await prisma.bounty.create({
    data: {
      tenantId: tenant.id,
      posterId: rao.id,
      title: "Write the first test for any department project",
      description:
        "Pick any project in BUILDING state, add one meaningful test, open a PR. Reserved for students with no verified work yet — this is the on-ramp, not a competition.",
      kind: "STARTER",
      skillsNeeded: [],
      rewardPoints: 40,
      reservedForNewcomers: true,
      maxClaims: 10,
      status: "OPEN",
      closesAt: new Date(Date.now() + 21 * 86400000),
    },
  });

  await prisma.bounty.create({
    data: {
      tenantId: tenant.id,
      posterId: alumni.id,
      title: "Load-test the lab booking API to 500 concurrent slots",
      description:
        "Find where it falls over and write up the failure mode. I will review and pair on the fix for an hour.",
      kind: "RESEARCH",
      track: "software-saas-platform",
      skillsNeeded: ["k6", "Postgres"],
      rewardPoints: 40,
      status: "OPEN",
      closesAt: new Date(Date.now() + 14 * 86400000),
    },
  });

  await prisma.bounty.create({
    data: {
      tenantId: tenant.id,
      posterId: hod.id,
      title: "Accessibility audit of the department website",
      description: "WCAG 2.1 AA. Report with screenshots and the specific failures, not a Lighthouse score.",
      kind: "REVIEW",
      skillsNeeded: ["Accessibility"],
      rewardPoints: 40,
      status: "OPEN",
    },
  });

  // ── Events ────────────────────────────────────────────────
  console.log("Creating events and demand votes…");

  const scheduled = await prisma.campusEvent.create({
    data: {
      tenantId: tenant.id,
      title: "Postgres for people who only know MongoDB",
      description: "Three hours, hands on. Schema design, indexes, and why your ledger needs constraints.",
      kind: "WORKSHOP",
      track: "software-saas-platform",
      status: "SCHEDULED",
      startsAt: new Date(Date.now() + 9 * 86400000),
      endsAt: new Date(Date.now() + 9 * 86400000 + 3 * 3600000),
      location: "Lab 3",
      capacity: 20,
      newcomerQuotaPercent: 40,
    },
  });

  // Deliberately oversubscribed: 28 registrations for 20 seats, so the
  // quota and the waitlist both have to do real work in the UI.
  const registrants = [...students].slice(0, 24);
  let openSeats = Math.floor(scheduled.capacity! * 0.6);
  let quotaSeats = scheduled.capacity! - openSeats;
  let waitlist = 0;
  for (const s of registrants) {
    const st = await prisma.standing.findUnique({ where: { membershipId: s.membershipId } });
    const newcomer = (st?.points ?? 0) < 150;
    let allocation: Prisma.EventRegistrationCreateInput["allocation"] = "OPEN";
    let status: Prisma.EventRegistrationCreateInput["status"] = "REGISTERED";
    let pos: number | null = null;

    if (newcomer && quotaSeats > 0) {
      allocation = "NEWCOMER_QUOTA";
      quotaSeats--;
    } else if (openSeats > 0) {
      allocation = "OPEN";
      openSeats--;
    } else {
      status = "WAITLISTED";
      pos = ++waitlist;
    }

    await prisma.eventRegistration.create({
      data: {
        eventId: scheduled.id,
        userId: s.id,
        allocation,
        status,
        waitlistPosition: pos,
      },
    });
  }

  // Proposed events exist only as demand. Faculty pick up what gets votes.
  const proposals = [
    ["Reading a flame graph without guessing", "PROPOSED", 17],
    ["Threat modelling your own project", "PROPOSED", 11],
    ["Designing for 4GB Android phones", "PROPOSED", 21],
    ["Writing a postmortem people actually read", "PROPOSED", 6],
  ] as const;

  for (const [title, status, votes] of proposals) {
    const ev = await prisma.campusEvent.create({
      data: {
        tenantId: tenant.id,
        title,
        description: "Proposed by students. Needs a faculty owner before it can be scheduled.",
        kind: "WORKSHOP",
        status: status as Prisma.CampusEventCreateInput["status"],
        capacity: null,
      },
    });
    const voters = [...students].sort(() => rand() - 0.5).slice(0, votes);
    for (const v of voters) {
      await prisma.eventDemandVote.create({
        data: { eventId: ev.id, userId: v.id },
      });
    }
  }

  // The seed writes verified evidence directly, bypassing the verification
  // handler that normally maintains this counter. Without this every project
  // ships with verifiedEvidenceCount = 0, which silently breaks the feed's
  // evidence ranking and the "trending" and "evidence" sorts on /api/ideas.
  const reconciled = await reconcileEvidenceCounts(tenant.id);
  console.log(
    `Evidence counters: ${reconciled.projectsCorrected} of ${reconciled.projectsChecked} projects corrected`
  );

  const summary = {
    students: students.length,
    projects: projects.length + 1,
    evidence: evidenceCount,
    reputationEvents: await prisma.reputationEvent.count(),
    bounties: await prisma.bounty.count(),
    events: await prisma.campusEvent.count(),
    demandVotes: await prisma.eventDemandVote.count(),
    zeroStandingStudents: await prisma.standing.count({ where: { points: 0 } }),
    evidenceAwaitingReview: await prisma.evidence.count({ where: { state: "UNDER_REVIEW" } }),
  };
  console.log("Seeded:", summary);
  console.log(
    `
Dev sign-in (development only):
  admin    a.rao@lendi.org
  hod      hod.cse@lendi.org
  faculty  k.suneetha@lendi.org
  student  harshith0@lendi.edu.in
  password ${DEV_PASSWORD}
`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
