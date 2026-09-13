import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Public campus counters for the landing page.
 *
 * Deliberately counts only things that exist: projects that were actually
 * published, and evidence a reviewer actually verified. Competitor landing
 * pages in this category advertise builder counts that render as "0+".
 */
export async function GET() {
  try {
    const [totalProjects, activeBuilds, shipped, totalUsers, verifiedEvidence, events] =
      await Promise.all([
        prisma.project.count({ where: { status: { notIn: ["DRAFT", "REJECTED"] } } }),
        prisma.project.count({ where: { status: "BUILDING" } }),
        prisma.project.count({ where: { status: "SHIPPED" } }),
        prisma.membership.count({ where: { status: "ACTIVE" } }),
        prisma.evidence.count({ where: { state: "VERIFIED" } }),
        prisma.campusEvent.count(),
      ]);

    return NextResponse.json({
      data: {
        totalIdeas: totalProjects,
        activeBuilds,
        shipped,
        totalUsers,
        totalProofs: verifiedEvidence,
        totalWorkshops: events,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch stats", { error: String(error) });
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
