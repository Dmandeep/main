import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { canApproveMembership } from "@/lib/authz/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

const rejectSchema = z.object({
  reason: z.string().max(300).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canApproveMembership(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "membership:decide",
      membership.userId,
      "You are rejecting too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id },
    });

    if (!accessRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { reason } = rejectSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.accessRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: membership.userId,
          reviewedAt: new Date(),
          rejectionReason: reason ?? "Request not eligible for department access",
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: accessRequest.tenantId,
          actorId: membership.userId,
          action: "access_request.rejected",
          targetType: "access_request",
          targetId: accessRequest.id,
          diff: {
            email: accessRequest.email,
            reason: reason ?? null,
          },
        },
      });

      return req;
    });

    logger.info("Access request rejected", { requestId: id, adminId: membership.userId });

    return NextResponse.json({
      success: true,
      message: "Access request rejected.",
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to reject access request", { error: String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
