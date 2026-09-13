import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { canVerifyEvidence } from "@/lib/authz/permissions";

/** Hours after which an unreviewed item is breaching the queue's SLA. */
const DEFAULT_SLA_HOURS = 72;

/**
 * The review queue.
 *
 * Oldest first, deliberately. A newest-first queue starves the submissions
 * that have already been waiting longest, which is exactly how a verification
 * backlog turns into students concluding that nobody reads their work.
 */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canVerifyEvidence(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

    const tenant = await prisma.tenant.findUnique({
      where: { id: membership.tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings ?? {}) as { verificationSlaHours?: number };
    const slaHours = settings.verificationSlaHours ?? DEFAULT_SLA_HOURS;
    const slaCutoff = new Date(Date.now() - slaHours * 3600_000);

    const pendingStates = ["SUBMITTED", "MACHINE_VERIFIED", "UNDER_REVIEW"] as const;

    const [items, queueDepth, breaching] = await Promise.all([
      prisma.evidence.findMany({
        where: {
          state: { in: [...pendingStates] },
          project: { tenantId: membership.tenantId },
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          sourceType: true,
          sourceUrl: true,
          sourceExternalId: true,
          contentHash: true,
          extractionConfidence: true,
          state: true,
          createdAt: true,
          capturedAt: true,
          creator: { select: userRefSelect },
          project: { select: { id: true, slug: true, title: true, track: true } },
          milestone: { select: { ordinal: true, title: true } },
        },
      }),
      prisma.evidence.count({
        where: {
          state: { in: [...pendingStates] },
          project: { tenantId: membership.tenantId },
        },
      }),
      prisma.evidence.count({
        where: {
          state: { in: [...pendingStates] },
          createdAt: { lt: slaCutoff },
          project: { tenantId: membership.tenantId },
        },
      }),
    ]);

    return NextResponse.json({
      data: items.map((e) => ({
        _id: e.id,
        targetId: e.project.id,
        targetType: "proof" as const,
        reviewType: "external_proof" as const,
        status: e.state === "UNDER_REVIEW" ? "in_review" : "pending",
        title: e.title,
        description: e.description ?? undefined,
        sourceType: e.sourceType,
        sourceUrl: e.sourceUrl,
        sourceExternalId: e.sourceExternalId ?? undefined,
        contentHash: e.contentHash ?? undefined,
        machineConfidence: e.extractionConfidence ?? undefined,
        milestone: e.milestone ?? undefined,
        project: e.project,
        ageHours: Math.floor((Date.now() - e.createdAt.getTime()) / 3600_000),
        breachingSla: e.createdAt < slaCutoff,
        submittedBy: {
          name: e.creator.name,
          username: e.creator.username,
          avatarUrl: e.creator.avatarUrl ?? undefined,
        },
        createdAt: e.createdAt.toISOString(),
      })),
      meta: { queueDepth, breaching, slaHours },
    });
  } catch (error) {
    logger.error("Failed to fetch review queue", { error: String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
