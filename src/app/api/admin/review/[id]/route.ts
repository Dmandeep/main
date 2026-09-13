import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { awardStanding } from "@/lib/standing/award";
import { createNotification } from "@/lib/notify";
import { canVerifyEvidence } from "@/lib/authz/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected", "in_review", "needs_info"]),
  reviewNotes: z.string().max(1000).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

/**
 * Decide on one piece of evidence.
 *
 * This is the only place standing is created from evidence. Verification is
 * the moment a claim becomes a record, so it is the moment the ledger moves —
 * not submission, and not any client-side action.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canVerifyEvidence(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "review:decide",
      membership.userId,
      "You are recording decisions too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const body = decisionSchema.parse(await req.json());

    const evidence = await prisma.evidence.findFirst({
      where: { id, project: { tenantId: membership.tenantId } },
      select: {
        id: true,
        state: true,
        creatorId: true,
        title: true,
        project: { select: { id: true, slug: true, title: true } },
      },
    });

    if (!evidence) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    // A reviewer must not verify their own submission. This is the cheapest
    // possible self-dealing route into the ledger.
    if (evidence.creatorId === membership.userId) {
      return NextResponse.json(
        { error: "You cannot review evidence you submitted." },
        { status: 409 }
      );
    }

    if (evidence.state === "VERIFIED" || evidence.state === "REJECTED") {
      return NextResponse.json({ error: "Already decided" }, { status: 409 });
    }

    if (body.status === "in_review") {
      await prisma.evidence.update({
        where: { id: evidence.id },
        data: { state: "UNDER_REVIEW" },
      });
      return NextResponse.json({ data: { id: evidence.id, state: "UNDER_REVIEW" } });
    }

    const approved = body.status === "approved";
    const rationale = body.reviewNotes?.trim();

    // A rejection a student cannot understand is a rejection they will appeal.
    if (!approved && (!rationale || rationale.length < 20)) {
      return NextResponse.json(
        {
          error:
            "A rejection needs a reason of at least 20 characters, describing what would make this acceptable.",
        },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.verificationReview.create({
        data: {
          evidenceId: evidence.id,
          reviewerId: membership.userId,
          decision: approved ? "APPROVED" : "REJECTED",
          confidence: body.confidence ?? null,
          rationale: rationale ?? null,
        },
      });

      await tx.evidence.update({
        where: { id: evidence.id },
        data: { state: approved ? "VERIFIED" : "REJECTED" },
      });

      if (approved) {
        const verified = await tx.evidence.count({
          where: { projectId: evidence.project.id, state: "VERIFIED" },
        });
        await tx.project.update({
          where: { id: evidence.project.id },
          data: { verifiedEvidenceCount: verified },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: approved ? "evidence.verified" : "evidence.rejected",
          targetType: "evidence",
          targetId: evidence.id,
          diff: { decision: approved ? "APPROVED" : "REJECTED", rationale: rationale ?? null },
        },
      });
    });

    // Standing is awarded outside the transaction and is idempotent, so a
    // retry cannot double-pay. A failure here leaves the verification intact
    // and the award recoverable by replay — the safe way round.
    let award = null;
    if (approved) {
      award = await awardStanding({
        tenantId: membership.tenantId,
        userId: evidence.creatorId,
        type: "EVIDENCE_VERIFIED",
        sourceType: "evidence",
        sourceId: evidence.id,
      });

      if (award.status !== "awarded") {
        logger.info("Verification did not move standing", {
          evidenceId: evidence.id,
          result: award.status,
        });
      }
    }

    await createNotification({
      tenantId: membership.tenantId,
      userId: evidence.creatorId,
      type: approved ? "EVIDENCE_VERIFIED" : "EVIDENCE_REJECTED",
      title: approved ? "Evidence verified" : "Evidence needs work",
      body: approved
        ? `"${evidence.title}" on ${evidence.project.title} was verified.`
        : `"${evidence.title}" was not accepted: ${rationale}`,
      href: `/ideas/${evidence.project.slug}`,
    });

    return NextResponse.json({
      data: {
        id: evidence.id,
        state: approved ? "VERIFIED" : "REJECTED",
        standing: award,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to decide evidence", { error: String(error) });
    return NextResponse.json({ error: "Failed to record decision" }, { status: 500 });
  }
}
