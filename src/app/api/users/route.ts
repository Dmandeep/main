import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership, userRefSelect } from "@/lib/tenant";

/** Department directory. Tenant-scoped, so it is never a cross-campus dump. */
export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    const members = await prisma.membership.findMany({
      where: {
        tenantId: membership.tenantId,
        status: "ACTIVE",
        ...(q
          ? {
              user: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { username: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      take: 50,
      orderBy: { standing: { points: "desc" } },
      select: {
        role: true,
        year: true,
        department: true,
        standing: { select: { points: true, tier: true, rank: true } },
        user: { select: { ...userRefSelect, bio: true } },
      },
    });

    return NextResponse.json({
      data: members.map((m) => ({
        _id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl ?? undefined,
        bio: m.user.bio ?? undefined,
        role: m.role.toLowerCase(),
        year: m.year ?? undefined,
        branch: m.department ?? undefined,
        points: m.standing?.points ?? 0,
        rankTier: m.standing?.tier ?? "BRONZE",
        rank: m.standing?.rank ?? undefined,
      })),
    });
  } catch (error) {
    logger.error("Failed to fetch users", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
