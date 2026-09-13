import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";
import { createNotification } from "@/lib/notify";
import { enforceRateLimit } from "@/lib/rate-limit";

const joinSchema = z.object({
  role: z.string().min(2).max(50),
  message: z.string().max(300).optional(),
});

/** Resolve a project by id or slug, tenant-scoped. */
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

    if (project.ownerId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await prisma.joinRequest.findMany({
      where: { projectId: project.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
        userId: true,
      },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: requests.map((r) => r.userId) } },
      select: userRefSelect,
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      data: requests.map((r) => {
        const u = byId.get(r.userId);
        return {
          _id: r.id,
          role: r.role,
          message: r.message ?? undefined,
          userId: {
            _id: u?.id ?? r.userId,
            name: u?.name ?? "Unknown",
            username: u?.username ?? "",
            avatarUrl: u?.avatarUrl ?? undefined,
          },
        };
      }),
    });
  } catch (error) {
    logger.error("Failed to fetch join requests", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch join requests" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "project:join",
      membership.userId,
      "You are sending join requests too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const project = await findProject(id, membership.tenantId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId === membership.userId) {
      return NextResponse.json({ error: "You already own this project" }, { status: 409 });
    }

    const alreadyMember = await prisma.projectMembership.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: membership.userId } },
      select: { leftAt: true },
    });
    if (alreadyMember && !alreadyMember.leftAt) {
      return NextResponse.json({ error: "You are already on this team" }, { status: 409 });
    }

    const data = joinSchema.parse(await req.json());

    try {
      const request = await prisma.joinRequest.create({
        data: {
          projectId: project.id,
          userId: membership.userId,
          role: data.role,
          message: data.message,
        },
        select: { id: true, role: true, message: true, status: true },
      });

      await createNotification({
        tenantId: membership.tenantId,
        userId: project.ownerId,
        type: "JOIN_REQUEST",
        title: "New request to join",
        body: `Someone asked to join ${project.title} as ${data.role}.`,
        href: `/ideas/${project.slug}`,
      });

      return NextResponse.json({ data: { ...request, _id: request.id } }, { status: 201 });
    } catch (error) {
      // Unique on (projectId, userId): one outstanding request per person.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "You already have a request on this project" },
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
    logger.error("Failed to create join request", { error: String(error) });
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "project:join",
      membership.userId,
      "You are handling join requests too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const project = await findProject(id, membership.tenantId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== membership.userId && membership.role !== "ADMIN") {
      return NextResponse.json({ error: "Only the project owner can decide" }, { status: 403 });
    }

    const { requestId, status } = await req.json();
    const decision = String(status).toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const joinRequest = await prisma.joinRequest.findFirst({
      where: { id: requestId, projectId: project.id },
      select: { id: true, userId: true, role: true, status: true },
    });
    if (!joinRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (joinRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Request already decided" }, { status: 409 });
    }

    // Decision and team change land together: an approved request that fails
    // to add the member leaves the student staring at a lie.
    await prisma.$transaction(async (tx) => {
      await tx.joinRequest.update({
        where: { id: joinRequest.id },
        data: {
          status: decision as Prisma.JoinRequestUpdateInput["status"],
          decidedAt: new Date(),
        },
      });

      if (decision === "APPROVED") {
        await tx.projectMembership.upsert({
          where: { projectId_userId: { projectId: project.id, userId: joinRequest.userId } },
          create: { projectId: project.id, userId: joinRequest.userId, role: joinRequest.role },
          update: { leftAt: null, role: joinRequest.role },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: membership.tenantId,
          actorId: membership.userId,
          action: `join_request.${decision.toLowerCase()}`,
          targetType: "join_request",
          targetId: joinRequest.id,
        },
      });
    });

    await createNotification({
      tenantId: membership.tenantId,
      userId: joinRequest.userId,
      type: "JOIN_DECISION",
      title: decision === "APPROVED" ? "You're on the team" : "Request declined",
      body:
        decision === "APPROVED"
          ? `You joined ${project.title} as ${joinRequest.role}.`
          : `Your request to join ${project.title} was declined.`,
      href: `/ideas/${project.slug}`,
    });

    return NextResponse.json({ data: { id: joinRequest.id, status: decision } });
  } catch (error) {
    logger.error("Failed to process join request", { error: String(error) });
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
