import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { submitEvidence } from "@/lib/evidence/submit";
import { enforceRateLimit } from "@/lib/rate-limit";

const evidenceSchema = z.object({
  title: z.string().min(5).max(120),
  url: z.string().url(),
  description: z.string().max(300).optional(),
  milestoneId: z.string().optional(),
  // Accepted for backwards compatibility with the existing form; the source
  // type is derived from the URL, not trusted from the client.
  type: z.string().optional(),
});

async function findProject(idOrSlug: string, tenantId: string) {
  return prisma.project.findFirst({
    where: { tenantId, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, title: true, ownerId: true },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await findProject(id, membership.tenantId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const evidence = await prisma.evidence.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        sourceType: true,
        state: true,
        createdAt: true,
        overallScore: true,
        creator: { select: userRefSelect },
        reviews: {
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { decision: true, rationale: true, decidedAt: true, reviewer: { select: userRefSelect } },
        },
      },
    });

    return NextResponse.json({
      data: evidence.map((e) => ({
        _id: e.id,
        title: e.title,
        description: e.description ?? undefined,
        url: e.sourceUrl,
        type: e.sourceType.toLowerCase(),
        status:
          e.state === "VERIFIED" ? "approved" : e.state === "REJECTED" ? "rejected" : "pending",
        state: e.state,
        pointsAwarded: e.state === "VERIFIED" ? 10 : 0,
        overallScore: e.overallScore,
        createdAt: e.createdAt.toISOString(),
        rationale: e.reviews[0]?.rationale ?? undefined,
        submitter: {
          _id: e.creator.id,
          name: e.creator.name,
          username: e.creator.username,
          avatarUrl: e.creator.avatarUrl ?? undefined,
        },
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch evidence", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch evidence" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "evidence:submit",
      membership.userId,
      "You are submitting evidence too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const project = await findProject(id, membership.tenantId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const onTeam = await prisma.projectMembership.findFirst({
      where: { projectId: project.id, userId: membership.userId, leftAt: null },
      select: { id: true },
    });

    if (!onTeam && membership.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only people on this team can submit evidence" },
        { status: 403 }
      );
    }

    const data = evidenceSchema.parse(await req.json());

    const result = await submitEvidence({
      tenantId: membership.tenantId,
      projectId: project.id,
      creatorId: membership.userId,
      title: data.title,
      url: data.url,
      description: data.description,
      milestoneId: data.milestoneId,
    });

    if (result.status === "duplicate") {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    if (result.status === "rejected") {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    const created = await prisma.evidence.findUniqueOrThrow({
      where: { id: result.evidenceId },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        sourceType: true,
        state: true,
        createdAt: true,
        creator: { select: userRefSelect },
      },
    });

    return NextResponse.json(
      {
        data: {
          _id: created.id,
          title: created.title,
          description: created.description ?? undefined,
          url: created.sourceUrl,
          type: created.sourceType.toLowerCase(),
          status: "pending",
          state: created.state,
          pointsAwarded: 0,
          createdAt: created.createdAt.toISOString(),
          submitter: {
            _id: created.creator.id,
            name: created.creator.name,
            username: created.creator.username,
            avatarUrl: created.creator.avatarUrl ?? undefined,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to submit evidence", { error: String(error) });
    return NextResponse.json({ error: "Failed to submit evidence" }, { status: 500 });
  }
}
