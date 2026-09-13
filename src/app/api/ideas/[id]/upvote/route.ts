import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pusherServer } from "@/lib/pusher";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Toggle an upvote.
 *
 * Upvotes are a discovery signal only. They earn no standing and do not drive
 * feed ranking — see docs/design/CAMPUS-ECOSYSTEM.md. That is what keeps them
 * uninteresting to farm.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "vote:toggle",
      membership.userId,
      "You are voting too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { tenantId: membership.tenantId, OR: [{ id }, { slug: id }] },
      select: { id: true, ownerId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Self-voting was possible before. It is the cheapest form of inflation,
    // so it is refused outright rather than filtered out of the count later.
    if (project.ownerId === membership.userId) {
      return NextResponse.json(
        { error: "You cannot upvote your own project." },
        { status: 409 }
      );
    }

    const existing = await prisma.vote.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: membership.userId } },
      select: { id: true },
    });

    // The count is recomputed inside the transaction rather than incremented,
    // so a double-submit cannot drift the counter away from the rows.
    const { voted, upvotes } = await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.vote.delete({ where: { id: existing.id } });
      } else {
        try {
          await tx.vote.create({
            data: { projectId: project.id, userId: membership.userId },
          });
        } catch (error) {
          // Concurrent double-click: the row is already there, which is the
          // state the caller wanted.
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
          ) {
            throw error;
          }
        }
      }

      const count = await tx.vote.count({ where: { projectId: project.id } });
      await tx.project.update({
        where: { id: project.id },
        data: { upvoteCount: count },
      });

      return { voted: !existing, upvotes: count };
    });

    // Realtime is best-effort. A failed broadcast must not fail the vote.
    try {
      await pusherServer.trigger("ideas-channel", "upvote-update", {
        ideaId: project.id,
        upvotes,
      });
    } catch (error) {
      logger.warn("Upvote broadcast failed", { error: String(error) });
    }

    return NextResponse.json({ data: { voted, upvotes } });
  } catch (error) {
    logger.error("Failed to toggle upvote", { error: String(error) });
    return NextResponse.json({ error: "Failed to upvote" }, { status: 500 });
  }
}
