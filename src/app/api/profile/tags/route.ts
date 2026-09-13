import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Self-assigned profile tags.
 *
 * Only SELF tags can be created or removed here. EARNED, COMMUNITY and FACULTY
 * tags are issued by something that happened — a verification, a moderator, a
 * faculty member — and a student deleting one would be editing the record of
 * their own history. Those are removed by whatever issued them.
 */

const MAX_SELF_TAGS = 12;

const createSchema = z.object({
  label: z
    .string()
    .min(2, "A tag needs at least two characters.")
    .max(24, "Keep tags short enough to read at a glance.")
    .regex(
      /^[\p{L}\p{N} +#.\-/]+$/u,
      "Letters, numbers, spaces and + # . - / only."
    ),
});

export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "default",
      membership.userId,
      "You are changing your profile too quickly. Try again shortly."
    );
    if (limited) return limited;

    const body = createSchema.parse(await req.json());
    const label = body.label.trim().replace(/\s+/g, " ");

    const selfCount = await prisma.profileTag.count({
      where: { userId: membership.userId, source: "SELF" },
    });
    if (selfCount >= MAX_SELF_TAGS) {
      return NextResponse.json(
        {
          error: `You can have ${MAX_SELF_TAGS} tags of your own. Remove one to add another.`,
        },
        { status: 422 }
      );
    }

    try {
      const tag = await prisma.profileTag.create({
        data: { userId: membership.userId, label, source: "SELF" },
        select: { id: true, label: true, source: true },
      });

      return NextResponse.json({
        data: { _id: tag.id, label: tag.label, source: tag.source.toLowerCase() },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "You already have that tag." }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid input", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to add profile tag", { error: String(error) });
    return NextResponse.json({ error: "Failed to add the tag" }, { status: 500 });
  }
}

const deleteSchema = z.object({ id: z.string() });

export async function DELETE(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = deleteSchema.parse(await req.json());

    const tag = await prisma.profileTag.findFirst({
      where: { id: body.id, userId: membership.userId },
      select: { id: true, source: true },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (tag.source !== "SELF") {
      return NextResponse.json(
        {
          error:
            "That tag was issued by something that happened, not chosen by you. It cannot be removed here.",
        },
        { status: 403 }
      );
    }

    await prisma.profileTag.delete({ where: { id: tag.id } });

    return NextResponse.json({ data: { removed: tag.id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    logger.error("Failed to remove profile tag", { error: String(error) });
    return NextResponse.json({ error: "Failed to remove the tag" }, { status: 500 });
  }
}
