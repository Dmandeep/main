import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { slugify } from "@/lib/utils";
import { ideaSchema } from "@/lib/validations/idea";
import { calculateHealthScore } from "@/lib/health-score";
import { getActiveMembership } from "@/lib/tenant";
import { projectCardSelect, toProjectCard } from "@/lib/projects/select";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Minimum brief completeness required to publish rather than stay a draft. */
const PUBLISH_THRESHOLD = 60;

/**
 * The feed.
 *
 * Ranking is evidence and relevance, never engagement — see
 * docs/design/CAMPUS-ECOSYSTEM.md. If upvotes drove the ordering, students
 * would optimise for reach, which is exactly what a contribution ledger must
 * not reward.
 */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const track = searchParams.get("track");
    const status = searchParams.get("status");
    const q = searchParams.get("q")?.trim();
    const sort = searchParams.get("sort") ?? "newest";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 50);
    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10) || 1, 1);

    const where: Prisma.ProjectWhereInput = {
      // Every query is tenant-scoped. This is the line that keeps one
      // department's records out of another's feed.
      tenantId: membership.tenantId,
      ...(track ? { track } : {}),
      ...(status
        ? { status: status.toUpperCase() as Prisma.ProjectWhereInput["status"] }
        : { status: { notIn: ["DRAFT", "REJECTED"] } }),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { problem: { contains: q, mode: "insensitive" } },
              { tags: { has: q.toLowerCase() } },
            ],
          }
        : {}),
    };

    const orderBy: Record<string, Prisma.ProjectOrderByWithRelationInput[]> = {
      newest: [{ createdAt: "desc" }],
      // "Trending" means recent verified work, not recent popularity.
      trending: [{ verifiedEvidenceCount: "desc" }, { updatedAt: "desc" }],
      health: [{ briefCompleteness: "desc" }, { createdAt: "desc" }],
      evidence: [{ verifiedEvidenceCount: "desc" }, { createdAt: "desc" }],
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: orderBy[sort] ?? orderBy.newest,
        skip: (page - 1) * limit,
        take: limit,
        select: projectCardSelect,
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      data: projects.map(toProjectCard),
      meta: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) },
    });
  } catch (error) {
    logger.error("Failed to fetch projects", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "project:create",
      membership.userId,
      "You are creating ideas too quickly. Try again shortly."
    );
    if (limited) return limited;

    const body = await req.json();
    const data = ideaSchema.parse(body);
    const wantsPublish = body.status === "discovery";

    // A revival must point at a real archived project in this department.
    // Accepting an arbitrary id would let a project claim descent from work it
    // has nothing to do with, and the lineage is shown to students as fact.
    let revivedFromId: string | null = null;
    if (data.revivedFromId) {
      const ancestor = await prisma.project.findFirst({
        where: {
          id: data.revivedFromId,
          tenantId: membership.tenantId,
          status: "ARCHIVED",
        },
        select: { id: true },
      });
      if (!ancestor) {
        return NextResponse.json(
          { error: "That project is not in the archive, so it cannot be revived." },
          { status: 422 }
        );
      }
      revivedFromId = ancestor.id;
    }

    const briefCompleteness = calculateHealthScore({
      title: data.title,
      tagline: data.tagline,
      problem: data.problem,
      solution: data.solution,
      tags: data.tags,
      track: data.track,
      githubUrl: data.githubUrl || undefined,
      demoUrl: data.demoUrl || undefined,
      coverImage: data.coverImage,
      collaboratorsCount: 0,
    });

    if (wantsPublish && briefCompleteness < PUBLISH_THRESHOLD) {
      return NextResponse.json(
        {
          error: `Brief is ${briefCompleteness}/100 complete. ${PUBLISH_THRESHOLD} is needed to publish.`,
          briefCompleteness,
        },
        { status: 422 }
      );
    }

    // Constraint 1: Exact title uniqueness (prevent idea repetition)
    const existingTitle = await prisma.project.findFirst({
      where: { tenantId: membership.tenantId, title: { equals: data.title, mode: 'insensitive' } },
      select: { id: true }
    });
    if (existingTitle) {
      return NextResponse.json({ error: "An idea with this exact title already exists. We don't allow duplicate ideas to ensure uniqueness." }, { status: 409 });
    }

    // Constraint 2: GitHub repo uniqueness (1 repo = 1 idea)
    if (data.githubUrl) {
      const existingRepo = await prisma.project.findFirst({
        where: { tenantId: membership.tenantId, githubUrl: data.githubUrl },
        select: { id: true }
      });
      if (existingRepo) {
        return NextResponse.json({ error: "This GitHub repository is already attached to another idea. One repository can only be used for one idea." }, { status: 409 });
      }
    }

    // Slug uniqueness is per tenant, enforced by a database constraint. The
    // retry loop handles the race between two people publishing the same title.
    const base = slugify(data.title);
    let slug = base;

    for (let attempt = 0; ; attempt++) {
      try {
        const project = await prisma.project.create({
          data: {
            tenantId: membership.tenantId,
            ownerId: membership.userId,
            slug,
            revivedFromId,
            title: data.title,
            tagline: data.tagline,
            problem: data.problem,
            solution: data.solution,
            track: data.track,
            tags: data.tags,
            skillsNeeded: data.skillsNeeded,
            coverImage: data.coverImage || null,
            githubUrl: data.githubUrl || null,
            demoUrl: data.demoUrl || null,
            status: wantsPublish ? "DISCOVERY" : "DRAFT",
            briefCompleteness,
            members: {
              create: { userId: membership.userId, role: "Owner" },
            },
          },
          select: projectCardSelect,
        });

        logger.info("Project created", {
          projectId: project.id,
          tenantId: membership.tenantId,
          briefCompleteness,
        });

        return NextResponse.json({ data: toProjectCard(project) }, { status: 201 });
      } catch (error) {
        const isSlugClash =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!isSlugClash || attempt >= 5) throw error;
        slug = `${base}-${attempt + 2}`;
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to create project", { error: String(error) });
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
