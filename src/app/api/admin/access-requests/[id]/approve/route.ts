import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { canApproveMembership } from "@/lib/authz/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

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
      "You are approving too quickly. Try again shortly."
    );
    if (limited) return limited;

    const { id } = await params;
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { id },
    });

    if (!accessRequest) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }

    if (accessRequest.status === "APPROVED") {
      return NextResponse.json({ error: "Access request is already approved" }, { status: 400 });
    }

    const email = accessRequest.email.toLowerCase();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update access request status
      const updatedRequest = await tx.accessRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: membership.userId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });

      // 2. Check if user already exists
      let user = await tx.user.findUnique({
        where: { email },
        include: { memberships: { where: { tenantId: accessRequest.tenantId } } },
      });

      if (!user) {
        // Create user seat without password (they log in via Google)
        const base = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const prefix = base.length >= 3 ? base : `user_${base}`;
        let username = prefix;
        for (let i = 1; await tx.user.findUnique({ where: { username } }); i++) {
          username = `${prefix}${i}`;
        }

        user = await tx.user.create({
          data: {
            email,
            name: accessRequest.name,
            username,
            memberships: {
              create: {
                tenantId: accessRequest.tenantId,
                role: "STUDENT",
                department: accessRequest.department ?? "CSE",
                year: accessRequest.year ?? 1,
                status: "ACTIVE",
              },
            },
          },
          include: { memberships: { where: { tenantId: accessRequest.tenantId } } },
        });
      } else if (user.memberships.length === 0) {
        // User exists but has no membership in this tenant
        await tx.membership.create({
          data: {
            tenantId: accessRequest.tenantId,
            userId: user.id,
            role: "STUDENT",
            department: accessRequest.department ?? "CSE",
            year: accessRequest.year ?? 1,
            status: "ACTIVE",
          },
        });
      } else if (user.memberships[0]?.status !== "ACTIVE") {
        await tx.membership.update({
          where: { id: user.memberships[0]!.id },
          data: { status: "ACTIVE" },
        });
      }

      // 3. Log audit event
      await tx.auditLog.create({
        data: {
          tenantId: accessRequest.tenantId,
          actorId: membership.userId,
          action: "access_request.approved",
          targetType: "access_request",
          targetId: accessRequest.id,
          diff: {
            email: accessRequest.email,
            name: accessRequest.name,
            userId: user.id,
          },
        },
      });

      return { request: updatedRequest, user };
    });

    logger.info("Access request approved by admin", {
      requestId: id,
      adminId: membership.userId,
      email,
    });

    return NextResponse.json({
      success: true,
      message: `Access approved for ${accessRequest.name} (${email}). They can now sign in with Google automatically.`,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to approve access request", { error: String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
