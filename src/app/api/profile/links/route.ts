import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isVerifiable, normaliseHandle } from "@/lib/profile/links";

/**
 * A student's own external profile links.
 *
 * Everything written here is a claim. `isVerified` is never settable by the
 * person making the claim — it is set only where an OAuth round trip proved
 * ownership, which today means GitHub and nothing else. Letting a student mark
 * their own LeetCode link verified would make the verified badge meaningless
 * everywhere it appears, including on evidence.
 */

const PLATFORMS = [
  "GITHUB",
  "LINKEDIN",
  "LEETCODE",
  "CODEFORCES",
  "CODECHEF",
  "HACKERRANK",
  "GEEKSFORGEEKS",
  "REDDIT",
  "DISCORD",
  "PERSONAL_SITE",
  "X",
] as const;

const upsertSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1).max(200),
  statLabel: z.string().max(40).optional(),
  statValue: z.string().max(40).optional(),
});

export async function PUT(req: Request) {
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

    const body = upsertSchema.parse(await req.json());
    const platformKey = body.platform.toLowerCase();
    const handle = normaliseHandle(platformKey, body.handle);

    if (!handle) {
      return NextResponse.json(
        { error: "That does not look like a username or a profile link." },
        { status: 422 }
      );
    }

    const link = await prisma.profileLink.upsert({
      where: { userId_platform: { userId: membership.userId, platform: body.platform } },
      create: {
        userId: membership.userId,
        platform: body.platform,
        handle,
        statLabel: body.statLabel?.trim() || null,
        statValue: body.statValue?.trim() || null,
      },
      update: {
        handle,
        statLabel: body.statLabel?.trim() || null,
        statValue: body.statValue?.trim() || null,
        // Changing the handle invalidates any proof that was attached to the
        // old one. A student who edits their GitHub username must re-link.
        ...(isVerifiable(platformKey) ? { isVerified: false, verifiedAt: null } : {}),
      },
      select: {
        id: true,
        platform: true,
        handle: true,
        isVerified: true,
        statLabel: true,
        statValue: true,
      },
    });

    return NextResponse.json({
      data: {
        _id: link.id,
        platform: link.platform.toLowerCase(),
        handle: link.handle,
        isVerified: link.isVerified,
        statLabel: link.statLabel ?? undefined,
        statValue: link.statValue ?? undefined,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to save profile link", { error: String(error) });
    return NextResponse.json({ error: "Failed to save the link" }, { status: 500 });
  }
}

const deleteSchema = z.object({ platform: z.enum(PLATFORMS) });

export async function DELETE(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = deleteSchema.parse(await req.json());

    try {
      await prisma.profileLink.delete({
        where: { userId_platform: { userId: membership.userId, platform: body.platform } },
      });
    } catch (error) {
      // Already gone is the state the caller wanted, so this is not an error.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")) {
        throw error;
      }
    }

    return NextResponse.json({ data: { removed: body.platform.toLowerCase() } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    logger.error("Failed to remove profile link", { error: String(error) });
    return NextResponse.json({ error: "Failed to remove the link" }, { status: 500 });
  }
}
