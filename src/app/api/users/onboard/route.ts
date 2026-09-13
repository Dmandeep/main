import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const onboardSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_-]+$/),
  bio: z.string().max(300).optional(),
  branch: z.string().max(60).optional(),
  year: z.number().int().min(1).max(6).optional(),
  githubUsername: z.string().max(39).optional(),
  // Accepted from the existing form but not yet stored: skills and interests
  // belong on a profile table that does not exist yet, and silently dropping
  // them is better than inventing a column the schema has not agreed to.
  skills: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  primaryTrack: z.string().optional(),
  secondaryTracks: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "user:onboard",
      session.user.id,
      "Too many attempts. Try again shortly."
    );
    if (limited) return limited;

    const data = onboardSchema.parse(await req.json());
    const username = data.username.toLowerCase();

    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          name: data.name,
          username,
          bio: data.bio ?? null,
          // Recorded as a claim only. `githubVerified` stays false until the
          // OAuth link proves the account belongs to this person.
          githubUsername: data.githubUsername || null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "That username is taken." }, { status: 409 });
      }
      throw error;
    }

    // Department and year live on the membership, not the user, because they
    // are per-tenant facts.
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
      select: { id: true },
    });

    if (membership && (data.branch || data.year)) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: {
          ...(data.branch ? { department: data.branch } : {}),
          ...(data.year ? { year: data.year } : {}),
        },
      });
    }

    logger.info("User onboarded", { userId: session.user.id, placed: Boolean(membership) });

    return NextResponse.json({
      data: { success: true, pendingPlacement: !membership },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Onboarding failed", { error: String(error) });
    return NextResponse.json({ error: "Onboarding failed" }, { status: 500 });
  }
}
