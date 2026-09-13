import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { isNewcomer, POINTS } from "@/lib/standing/rules";
import { createNotifications } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const standing = await prisma.standing.findUnique({
      where: { membershipId: membership.membershipId },
      select: { points: true },
    });
    const newcomer = isNewcomer(standing?.points ?? 0);

    const bounties = await prisma.bounty.findMany({
      where: { tenantId: membership.tenantId, status: { in: ["OPEN", "IN_REVIEW"] } },
      orderBy: [{ reservedForNewcomers: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        track: true,
        skillsNeeded: true,
        rewardPoints: true,
        reservedForNewcomers: true,
        maxClaims: true,
        status: true,
        closesAt: true,
        poster: { select: userRefSelect },
        _count: { select: { submissions: true } },
        // Whether this viewer already has a submission in. Without it the list
        // cannot distinguish a bounty you have not looked at from one you have
        // already done, so the only way to find out is to open every card.
        submissions: {
          where: { userId: membership.userId },
          select: { status: true, submittedAt: true },
        },
      },
    });

    return NextResponse.json({
      data: bounties.map((b) => ({
        _id: b.id,
        title: b.title,
        description: b.description,
        kind: b.kind.toLowerCase(),
        track: b.track ?? undefined,
        skillsNeeded: b.skillsNeeded,
        rewardPoints: b.rewardPoints,
        reservedForNewcomers: b.reservedForNewcomers,
        // Reserved bounties are the on-ramp for students with no history.
        // Everyone can see them; only newcomers can claim them.
        claimable: !b.reservedForNewcomers || newcomer,
        submissions: b._count.submissions,
        maxClaims: b.maxClaims,
        status: b.status.toLowerCase(),
        // Slots left, so a bounty at its claim limit says so on the card.
        claimsLeft: Math.max(b.maxClaims - b._count.submissions, 0),
        viewerSubmission: b.submissions[0]
          ? {
              status: b.submissions[0].status.toLowerCase(),
              submittedAt: b.submissions[0].submittedAt.toISOString(),
            }
          : null,
        deadlineAt: b.closesAt?.toISOString() ?? null,
        postedBy: {
          name: b.poster.name,
          username: b.poster.username,
          avatarUrl: b.poster.avatarUrl ?? undefined,
        },
      })),
      meta: { viewerIsNewcomer: newcomer },
    });
  } catch (error) {
    logger.error("Failed to fetch bounties", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch bounties" }, { status: 500 });
  }
}

/** Roles permitted to post a bounty. Students cannot create demand for points. */
const POSTER_ROLES = ["FACULTY", "ADMIN", "MENTOR", "ALUMNI"] as const;

const createBountySchema = z.object({
  title: z.string().min(8, "Give the bounty a title of at least 8 characters.").max(120),
  description: z
    .string()
    .min(40, "Describe what done looks like — at least 40 characters.")
    .max(2000),
  kind: z.enum(["BUILD", "RESEARCH", "DESIGN", "MENTOR", "REVIEW", "STARTER"]),
  track: z.string().max(60).optional(),
  skillsNeeded: z.array(z.string().max(40)).max(10).default([]),
  reservedForNewcomers: z.boolean().default(false),
  maxClaims: z.number().int().min(1).max(50).default(1),
  closesAt: z.string().datetime().optional(),
  publish: z.boolean().default(true),
});

/**
 * Post a bounty.
 *
 * The reward is NOT client-supplied. Points come from the standing rules, so a
 * faculty member cannot mint an arbitrarily valuable bounty and inflate someone
 * into the top of the leaderboard — the value of completing work is a property
 * of the system, not of whoever wrote the post.
 */
export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "bounty:create",
      membership.userId,
      "You are posting bounties too quickly. Try again shortly."
    );
    if (limited) return limited;

    if (!POSTER_ROLES.includes(membership.role as (typeof POSTER_ROLES)[number])) {
      return NextResponse.json(
        { error: "Only faculty, mentors, alumni and admins can post bounties." },
        { status: 403 }
      );
    }

    const data = createBountySchema.parse(await req.json());

    const closesAt = data.closesAt ? new Date(data.closesAt) : null;
    if (closesAt && closesAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "The closing date is in the past." },
        { status: 422 }
      );
    }

    const bounty = await prisma.bounty.create({
      data: {
        tenantId: membership.tenantId,
        posterId: membership.userId,
        title: data.title,
        description: data.description,
        kind: data.kind,
        track: data.track || null,
        skillsNeeded: data.skillsNeeded,
        rewardPoints: POINTS.BOUNTY_COMPLETED,
        reservedForNewcomers: data.reservedForNewcomers,
        maxClaims: data.maxClaims,
        closesAt,
        status: data.publish ? "OPEN" : "DRAFT",
      },
      select: { id: true, title: true, status: true, reservedForNewcomers: true },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        actorId: membership.userId,
        action: "bounty.created",
        targetType: "bounty",
        targetId: bounty.id,
        diff: { title: bounty.title, reservedForNewcomers: bounty.reservedForNewcomers },
      },
    });

    // A reserved bounty exists to reach students with no verified work, so it
    // is announced to exactly them rather than sitting in a list they never open.
    if (bounty.status === "OPEN" && bounty.reservedForNewcomers) {
      const newcomers = await prisma.membership.findMany({
        where: {
          tenantId: membership.tenantId,
          role: "STUDENT",
          status: "ACTIVE",
          OR: [{ standing: { is: null } }, { standing: { points: { lt: 150 } } }],
        },
        select: { userId: true },
      });

      await createNotifications(
        newcomers.map((m) => ({
          tenantId: membership.tenantId,
          userId: m.userId,
          type: "SYSTEM" as const,
          title: "A bounty is held open for you",
          body: `"${bounty.title}" is reserved for students without verified work yet.`,
          href: `/bounties/${bounty.id}`,
        }))
      );
    }

    logger.info("Bounty created", {
      bountyId: bounty.id,
      tenantId: membership.tenantId,
      reserved: bounty.reservedForNewcomers,
    });

    return NextResponse.json({ data: { _id: bounty.id, ...bounty } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to create bounty", { error: String(error) });
    return NextResponse.json({ error: "Failed to create bounty" }, { status: 500 });
  }
}
