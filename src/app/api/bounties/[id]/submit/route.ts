import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { isNewcomer } from "@/lib/standing/rules";
import { awardStanding } from "@/lib/standing/award";
import { createNotification } from "@/lib/notify";
import { bountyDetailSelect, claimEligibility } from "@/lib/bounties/select";
import { enforceRateLimit } from "@/lib/rate-limit";

const submitSchema = z.object({
  summary: z
    .string()
    .min(30, "Say what you did and where the work is — at least 30 characters.")
    .max(1000),
  /** Evidence rows backing the claim. Required: a bounty pays for proof. */
  evidenceIds: z.array(z.string()).min(1, "Attach at least one piece of evidence."),
});

/**
 * Submit to a bounty.
 *
 * Submitting does not pay. Awarding does, and only an award by someone other
 * than the claimant moves the ledger — same rule as evidence verification.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "bounty:submit",
      membership.userId,
      "You are submitting too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const bounty = await prisma.bounty.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: bountyDetailSelect,
    });
    if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

    const standing = await prisma.standing.findUnique({
      where: { membershipId: membership.membershipId },
      select: { points: true },
    });

    const eligibility = claimEligibility({
      status: bounty.status,
      closesAt: bounty.closesAt,
      maxClaims: bounty.maxClaims,
      reservedForNewcomers: bounty.reservedForNewcomers,
      posterId: bounty.poster.id,
      submissionCount: bounty.submissions.length,
      viewerId: membership.userId,
      viewerIsNewcomer: isNewcomer(standing?.points ?? 0),
      viewerHasSubmitted: bounty.submissions.some((s) => s.user.id === membership.userId),
    });

    if (!eligibility.canClaim) {
      return NextResponse.json(
        { error: eligibility.message, reason: eligibility.reason },
        { status: 409 }
      );
    }

    const data = submitSchema.parse(await req.json());

    // Evidence must exist, belong to this campus, and be the claimant's own.
    // Without this check a student could cite someone else's verified work.
    const evidence = await prisma.evidence.findMany({
      where: {
        id: { in: data.evidenceIds },
        creatorId: membership.userId,
        project: { tenantId: membership.tenantId },
      },
      select: { id: true },
    });

    if (evidence.length !== data.evidenceIds.length) {
      return NextResponse.json(
        { error: "Some of that evidence does not exist or is not yours." },
        { status: 422 }
      );
    }

    try {
      const submission = await prisma.bountySubmission.create({
        data: {
          bountyId: bounty.id,
          userId: membership.userId,
          summary: data.summary,
          evidenceIds: evidence.map((e) => e.id),
        },
        select: { id: true, status: true, submittedAt: true },
      });

      await createNotification({
        tenantId: membership.tenantId,
        userId: bounty.poster.id,
        type: "SYSTEM",
        title: "New bounty submission",
        body: `Someone submitted to "${bounty.title}".`,
        href: `/bounties/${bounty.id}`,
      });

      return NextResponse.json(
        { data: { _id: submission.id, status: submission.status.toLowerCase() } },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "You have already submitted to this bounty." },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to submit to bounty", { error: String(error) });
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}

const decideSchema = z.object({
  submissionId: z.string(),
  decision: z.enum(["AWARDED", "REJECTED"]),
  reviewNote: z.string().max(1000).optional(),
});

/**
 * Award or reject a submission. Poster or admin only.
 *
 * This is the only path that pays a bounty, and `awardStanding` is idempotent,
 * so a double-click cannot pay twice.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const bounty = await prisma.bounty.findFirst({
      where: { id, tenantId: membership.tenantId },
      select: { id: true, title: true, posterId: true },
    });
    if (!bounty) return NextResponse.json({ error: "Bounty not found" }, { status: 404 });

    if (bounty.posterId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only the person who posted this bounty can decide on it." },
        { status: 403 }
      );
    }

    const body = decideSchema.parse(await req.json());

    const submission = await prisma.bountySubmission.findFirst({
      where: { id: body.submissionId, bountyId: bounty.id },
      select: { id: true, userId: true, status: true },
    });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (submission.status === "AWARDED" || submission.status === "REJECTED") {
      return NextResponse.json({ error: "Already decided" }, { status: 409 });
    }

    // Self-award is the obvious hole once a bounty pays standing.
    if (submission.userId === membership.userId) {
      return NextResponse.json(
        { error: "You cannot award a bounty to yourself." },
        { status: 409 }
      );
    }

    const awarded = body.decision === "AWARDED";
    const note = body.reviewNote?.trim();

    if (!awarded && (!note || note.length < 20)) {
      return NextResponse.json(
        { error: "A rejection needs a reason of at least 20 characters." },
        { status: 422 }
      );
    }

    await prisma.$transaction([
      prisma.bountySubmission.update({
        where: { id: submission.id },
        data: {
          status: body.decision,
          reviewNote: note ?? null,
          awardedAt: awarded ? new Date() : null,
        },
      }),
      prisma.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: `bounty_submission.${body.decision.toLowerCase()}`,
          targetType: "bounty_submission",
          targetId: submission.id,
          diff: { bountyId: bounty.id, note: note ?? null },
        },
      }),
    ]);

    let award = null;
    if (awarded) {
      award = await awardStanding({
        tenantId: membership.tenantId,
        userId: submission.userId,
        type: "BOUNTY_COMPLETED",
        sourceType: "bounty_submission",
        sourceId: submission.id,
      });
    }

    await createNotification({
      tenantId: membership.tenantId,
      userId: submission.userId,
      type: awarded ? "BOUNTY_AWARDED" : "SYSTEM",
      title: awarded ? "Bounty awarded" : "Bounty submission not accepted",
      body: awarded
        ? `Your submission to "${bounty.title}" was awarded.`
        : `Your submission to "${bounty.title}" was not accepted: ${note}`,
      href: `/bounties/${bounty.id}`,
    });

    return NextResponse.json({
      data: { id: submission.id, status: body.decision, standing: award },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    logger.error("Failed to decide bounty submission", { error: String(error) });
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
