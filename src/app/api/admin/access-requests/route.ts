import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { canApproveMembership } from "@/lib/authz/permissions";

export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canApproveMembership(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const where: Record<string, unknown> = {
      tenantId: membership.tenantId,
    };

    if (statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam.toUpperCase())) {
      where.status = statusParam.toUpperCase();
    }

    const requests = await prisma.accessRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        reviewedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const pendingCount = await prisma.accessRequest.count({
      where: { tenantId: membership.tenantId, status: "PENDING" },
    });

    return NextResponse.json({
      data: requests,
      meta: {
        total: requests.length,
        pendingCount,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch access requests", { error: String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
