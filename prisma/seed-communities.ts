/**
 * Demo communities, messages, posts and profiles.
 *
 * Runs after the main seed. Separate file because this is presentation data —
 * it is meant to be deleted wholesale before a real pilot, and keeping it out
 * of the core seed makes that a one-line change rather than an archaeology
 * exercise.
 *
 * Conversations are written to look like a real department: someone stuck on a
 * bug, a senior answering, a first-year asking where to start, a moderator
 * removing something. Uniformly cheerful mock data teaches you nothing about
 * whether the UI works.
 */
import { PrismaClient, type CommunityKind, type CommunityVisibility } from "@prisma/client";
import { isStaff } from "@/lib/authz/permissions";
import { assertLocalDatabase } from "./seed-guard";

const prisma = new PrismaClient();

assertLocalDatabase();

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ select: { id: true, name: true } });

  console.log("Clearing demo community data…");
  await prisma.$transaction([
    prisma.messageReport.deleteMany(),
    prisma.communityMessage.deleteMany(),
    prisma.communityMember.deleteMany(),
    prisma.post.deleteMany(),
    prisma.community.deleteMany(),
    prisma.profileLink.deleteMany(),
    prisma.profileTag.deleteMany(),
  ]);

  const members = await prisma.membership.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    select: {
      userId: true,
      role: true,
      year: true,
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  const students = members.filter((m) => m.role === "STUDENT");
  const staff = members.filter((m) => isStaff(m.role));
  const alumni = members.filter((m) => m.role === "ALUMNI");
  const byYear = (y: number) => students.filter((s) => s.year === y);

  const projects = await prisma.project.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, slug: true, title: true, members: { select: { userId: true } } },
  });

  const events = await prisma.campusEvent.findMany({
    where: { tenantId: tenant.id, status: "SCHEDULED" },
    select: { id: true, title: true, registrations: { select: { userId: true } } },
  });

  // ── Department-wide ────────────────────────────────────────
  console.log("Creating communities…");

  async function createCommunity(input: {
    slug: string;
    name: string;
    description: string;
    kind: CommunityKind;
    visibility?: CommunityVisibility;
    isSystemManaged?: boolean;
    projectId?: string;
    eventId?: string;
    batchYear?: number;
    memberIds: string[];
    ownerId?: string;
    moderatorIds?: string[];
  }) {
    const community = await prisma.community.create({
      data: {
        tenantId: tenant.id,
        slug: input.slug,
        name: input.name,
        description: input.description,
        kind: input.kind,
        visibility: input.visibility ?? "CAMPUS",
        isSystemManaged: input.isSystemManaged ?? false,
        projectId: input.projectId ?? null,
        eventId: input.eventId ?? null,
        batchYear: input.batchYear ?? null,
      },
      select: { id: true, slug: true },
    });

    const unique = [...new Set(input.memberIds)];
    await prisma.communityMember.createMany({
      data: unique.map((userId) => ({
        communityId: community.id,
        userId,
        role:
          userId === input.ownerId
            ? ("OWNER" as const)
            : input.moderatorIds?.includes(userId)
              ? ("MODERATOR" as const)
              : ("MEMBER" as const),
      })),
    });

    return community;
  }

  const everyone = members.map((m) => m.userId);

  const departmentRoom = await createCommunity({
    slug: "cse-department",
    name: "CSE Department",
    description: "Everyone in the department. Announcements, questions, and anything that does not belong anywhere else.",
    kind: "DEPARTMENT",
    isSystemManaged: true,
    memberIds: everyone,
    ownerId: staff[0]?.userId,
    moderatorIds: staff.map((s) => s.userId),
  });

  // Batch rooms: every student lands somewhere on day one.
  const batchRooms = [];
  for (const year of [1, 2, 3, 4]) {
    const cohort = byYear(year);
    if (cohort.length === 0) continue;
    const intakeYear = 2026 - year + 1;
    batchRooms.push(
      await createCommunity({
        slug: `cse-${intakeYear}`,
        name: `CSE ${intakeYear}`,
        description: `Year ${year} cohort. Your batch, your questions, your seniors one room away.`,
        kind: "BATCH",
        isSystemManaged: true,
        batchYear: intakeYear,
        memberIds: [...cohort.map((s) => s.userId), ...staff.map((s) => s.userId)],
        moderatorIds: staff.map((s) => s.userId),
      })
    );
  }

  // Project rooms, private to the team.
  const projectRooms = [];
  for (const project of projects.slice(0, 5)) {
    projectRooms.push(
      await createCommunity({
        slug: `project-${project.slug}`.slice(0, 60),
        name: project.title,
        description: `Working room for ${project.title}.`,
        kind: "PROJECT",
        visibility: "PRIVATE",
        isSystemManaged: true,
        projectId: project.id,
        memberIds: project.members.map((m) => m.userId),
        ownerId: project.members[0]?.userId,
      })
    );
  }

  // Interest communities, student-created.
  const interests = [
    ["competitive-programming", "Competitive Programming", "Contest post-mortems, practice sets and who is doing ICPC this year."],
    ["open-source", "Open Source", "First PRs, good-first-issue hunting, and getting your patch reviewed."],
    ["placements-2026", "Placements 2026", "Interview experiences, DSA sheets that actually helped, and honest company reviews."],
    ["hardware-iot", "Hardware and IoT", "ESP32, sensors, and everyone who has fried a board at least once."],
  ] as const;

  const interestRooms = [];
  for (const [slug, name, description] of interests) {
    const joiners = students.filter(() => Math.random() > 0.45);
    interestRooms.push(
      await createCommunity({
        slug,
        name,
        description,
        kind: "INTEREST",
        memberIds: [...joiners.map((s) => s.userId), ...alumni.map((a) => a.userId)],
        ownerId: joiners[0]?.userId ?? students[0]!.userId,
      })
    );
  }

  // One room that has to be asked for. Every seeded community was open, so
  // the request-to-join path had no demo data at all — which is part of why it
  // sat half-built, with the API telling students to ask a moderator and no
  // way for them to ask.
  const askFirst = students.filter(() => Math.random() > 0.7);
  interestRooms.push(
    await createCommunity({
      slug: "acm-chapter-core",
      name: "ACM Chapter Core",
      description:
        "The organising team for the student chapter. Ask to join and a moderator will add you before the next planning cycle.",
      kind: "INTEREST",
      visibility: "REQUEST_TO_JOIN",
      memberIds: askFirst.map((s) => s.userId),
      ownerId: askFirst[0]?.userId ?? students[0]!.userId,
      moderatorIds: askFirst.slice(0, 2).map((s) => s.userId),
    })
  );

  // Event rooms.
  for (const event of events) {
    await createCommunity({
      slug: `event-${event.id.slice(-8)}`,
      name: event.title,
      description: `Coordination for ${event.title}. Archived after the event.`,
      kind: "EVENT",
      isSystemManaged: true,
      eventId: event.id,
      memberIds: [...event.registrations.map((r) => r.userId), ...staff.map((s) => s.userId)],
      moderatorIds: staff.map((s) => s.userId),
    });
  }

  // ── Conversations ──────────────────────────────────────────
  console.log("Writing conversations…");

  const senior = byYear(4)[0] ?? students[students.length - 1]!;
  const junior = byYear(1)[0] ?? students[0]!;
  const mid = byYear(3)[0] ?? students[1]!;
  const facultyUser = staff[0]!;
  const alum = alumni[0];

  async function say(
    communityId: string,
    authorId: string,
    body: string,
    minsAgo: number,
    replyToId?: string
  ) {
    return prisma.communityMessage.create({
      data: { communityId, authorId, body, createdAt: minutesAgo(minsAgo), replyToId: replyToId ?? null },
      select: { id: true },
    });
  }

  const opener = await say(
    departmentRoom.id,
    facultyUser.userId,
    "Reminder: evidence submitted before Friday gets reviewed this week. Anything after that waits until the next cycle.",
    600
  );
  await say(
    departmentRoom.id,
    mid.userId,
    "Is a deploy URL enough on its own, or does it need the PR as well?",
    540,
    opener.id
  );
  await say(
    departmentRoom.id,
    facultyUser.userId,
    "A deploy on its own is fine if it is reachable. The PR helps when the deploy is behind auth.",
    520,
    opener.id
  );

  const firstYearRoom = batchRooms.find((r) => r.slug.endsWith("2026")) ?? batchRooms[0];
  if (firstYearRoom) {
    const ask = await say(
      firstYearRoom.id,
      junior.userId,
      "I have nothing on my record yet and every bounty looks like it needs experience I do not have. Where do people actually start?",
      300
    );
    await say(
      firstYearRoom.id,
      senior.userId,
      "Take the starter bounty — it is held for people with no verified work, so seniors cannot take it from you. Add one test to any project in BUILDING and open a PR.",
      280,
      ask.id
    );
    await say(
      firstYearRoom.id,
      junior.userId,
      "Did not realise it was reserved. Doing that tonight.",
      265,
      ask.id
    );
  }

  const cpRoom = interestRooms[0];
  if (cpRoom && alum) {
    const thread = await say(
      cpRoom.id,
      mid.userId,
      "Stuck on a segment tree problem where the lazy propagation is off by one on range updates. Anyone free to look?",
      180
    );
    await say(
      cpRoom.id,
      alum.userId,
      "Classic: your push-down is running after you read the child instead of before. Post the update function and I will point at the line.",
      150,
      thread.id
    );
  }

  // A removed message, so moderation has something real to render.
  const osRoom = interestRooms[1];
  if (osRoom) {
    await say(osRoom.id, senior.userId, "Anyone got the link to the contribution guide?", 120);
    const spam = await say(
      osRoom.id,
      students[students.length - 2]!.userId,
      "BUY CHEAP ASSIGNMENT SOLUTIONS DM ME",
      100
    );
    await prisma.communityMessage.update({
      where: { id: spam.id },
      data: {
        removedAt: minutesAgo(95),
        removedById: facultyUser.userId,
        removedReason: "Advertising academic misconduct.",
      },
    });
    await prisma.messageReport.create({
      data: {
        messageId: spam.id,
        reporterId: senior.userId,
        reason: "Selling assignment solutions.",
        status: "UPHELD",
        reviewedById: facultyUser.userId,
        reviewNote: "Removed and the student has been spoken to.",
        reviewedAt: minutesAgo(95),
      },
    });
  }

  // ── Posts ──────────────────────────────────────────────────
  console.log("Creating posts…");

  const shipped = projects.filter((p) => p.title.includes("Mess") || p.title.includes("Water"));
  for (const project of shipped) {
    await prisma.post.create({
      data: {
        tenantId: tenant.id,
        authorId: project.members[0]!.userId,
        kind: "SHOWCASE",
        body: `${project.title} is live and the mess staff are using the number daily. Writing up what the model got wrong in week one.`,
        projectId: project.id,
        createdAt: minutesAgo(240),
      },
    });
  }

  await prisma.post.create({
    data: {
      tenantId: tenant.id,
      authorId: mid.userId,
      kind: "ASK_FOR_HELP",
      body: "Looking for one person who has done ESP32 deep sleep before. Our tank monitor drains a battery in two days and it should last weeks.",
      projectId: projects.find((p) => p.title.includes("Water"))?.id ?? null,
      communityId: interestRooms[3]?.id ?? null,
      createdAt: minutesAgo(90),
    },
  });

  // ── Profiles ───────────────────────────────────────────────
  console.log("Creating profiles…");

  const PLATFORMS = [
    { platform: "LEETCODE" as const, statLabel: "Solved", statValue: "412" },
    { platform: "CODEFORCES" as const, statLabel: "Rating", statValue: "1547" },
    { platform: "GEEKSFORGEEKS" as const, statLabel: "Solved", statValue: "230" },
    { platform: "HACKERRANK" as const, statLabel: "Badges", statValue: "9" },
    { platform: "LINKEDIN" as const },
    { platform: "REDDIT" as const },
    { platform: "DISCORD" as const },
  ];

  for (const student of students.slice(0, 18)) {
    const picks = PLATFORMS.filter(() => Math.random() > 0.45).slice(0, 4);

    for (const [i, p] of picks.entries()) {
      await prisma.profileLink.create({
        data: {
          userId: student.userId,
          platform: p.platform,
          handle: student.user.username,
          // Nothing here is verified: none of these platforms offer OAuth, so
          // every one renders as a claim. Only GitHub can ever be true.
          isVerified: false,
          statLabel: "statLabel" in p ? p.statLabel : null,
          statValue: "statValue" in p ? p.statValue : null,
          displayOrder: i,
        },
      });
    }

    // GitHub, verified where the seed marked the account as linked.
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: student.userId },
      select: { githubUsername: true, githubVerified: true },
    });
    if (u.githubUsername) {
      await prisma.profileLink.create({
        data: {
          userId: student.userId,
          platform: "GITHUB",
          handle: u.githubUsername,
          isVerified: u.githubVerified,
          verifiedAt: u.githubVerified ? minutesAgo(10000) : null,
          displayOrder: -1,
        },
      });
    }
  }

  // Tags: earned ones come from the system, self ones are decoration.
  const topStandings = await prisma.standing.findMany({
    where: { membership: { tenantId: tenant.id } },
    orderBy: { points: "desc" },
    take: 3,
    select: { membership: { select: { userId: true } } },
  });

  for (const [i, s] of topStandings.entries()) {
    await prisma.profileTag.create({
      data: {
        userId: s.membership.userId,
        label: i === 0 ? "Top of the season" : "Top 3 this season",
        source: "EARNED",
        sourceRef: "leaderboard",
      },
    });
  }

  const SELF_TAGS = ["backend", "embedded", "ui", "ml", "security", "design", "data"];
  for (const student of students.slice(0, 20)) {
    for (const label of SELF_TAGS.filter(() => Math.random() > 0.7).slice(0, 3)) {
      await prisma.profileTag.create({
        data: { userId: student.userId, label, source: "SELF" },
      });
    }
  }

  for (const student of students.slice(0, 8)) {
    await prisma.user.update({
      where: { id: student.userId },
      data: {
        headline: [
          "Building things that survive the semester",
          "Backend, mostly Postgres",
          "Embedded systems and bad soldering",
          "Trying to ship one real thing this year",
        ][Math.floor(Math.random() * 4)],
        pronouns: null,
        accentColor: ["#0F6B4F", "#8A5A00", "#14161A"][Math.floor(Math.random() * 3)],
      },
    });
  }

  /**
   * Notifications, derived from things that actually happened in the seed.
   *
   * There were none at all before, so the notifications page was empty in
   * every demo and on every fresh install — a surface that cannot demonstrate
   * itself reads as broken. These are generated from real verified evidence
   * and real event seats rather than invented, so every one links somewhere
   * that exists.
   */
  await prisma.notification.deleteMany({ where: { tenantId: tenant.id } });

  const verifiedForNotice = await prisma.evidence.findMany({
    where: { state: "VERIFIED", project: { tenantId: tenant.id } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      title: true,
      creatorId: true,
      updatedAt: true,
      project: { select: { slug: true, title: true } },
    },
  });

  const seatsForNotice = await prisma.eventRegistration.findMany({
    where: { status: "REGISTERED", event: { tenantId: tenant.id } },
    take: 8,
    select: { userId: true, event: { select: { title: true } } },
  });

  await prisma.notification.createMany({
    data: [
      ...verifiedForNotice.map((e) => ({
        tenantId: tenant.id,
        userId: e.creatorId,
        type: "EVIDENCE_VERIFIED" as const,
        title: "Evidence verified",
        body: `"${e.title}" on ${e.project.title} was signed off.`,
        href: `/ideas/${e.project.slug}`,
        isRead: Math.random() > 0.6,
        createdAt: e.updatedAt,
      })),
      ...seatsForNotice.map((r) => ({
        tenantId: tenant.id,
        userId: r.userId,
        type: "EVENT_SEAT_CONFIRMED" as const,
        title: "Seat confirmed",
        body: `Your seat at "${r.event.title}" is confirmed.`,
        href: "/events",
        isRead: Math.random() > 0.5,
      })),
    ],
  });

  const summary = {
    communities: await prisma.community.count(),
    members: await prisma.communityMember.count(),
    messages: await prisma.communityMessage.count(),
    removedMessages: await prisma.communityMessage.count({ where: { removedAt: { not: null } } }),
    reports: await prisma.messageReport.count(),
    posts: await prisma.post.count(),
    profileLinks: await prisma.profileLink.count(),
    verifiedLinks: await prisma.profileLink.count({ where: { isVerified: true } }),
    tags: await prisma.profileTag.count(),
    notifications: await prisma.notification.count(),
  };
  console.log("Demo data:", summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
