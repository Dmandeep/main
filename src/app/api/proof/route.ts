import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const SOURCE_LABEL: Record<string, string> = {
  GITHUB_PR: "Pull request merged",
  GITHUB_COMMIT: "Code shipped",
  GITHUB_RELEASE: "Release tagged",
  DEPLOYED_URL: "Deployment live",
  DESIGN_FILE: "Design published",
  RESEARCH_OUTPUT: "Research submitted",
  PRESENTATION: "Presentation given",
  MEDIA: "Media published",
  DOCUMENT: "Document added",
  EXTERNAL_VALIDATION: "External validation",
};

/**
 * The Ledger Rail: the campus's most recent verified work.
 *
 * Only VERIFIED rows appear. An unverified submission is a claim, and the
 * whole product rests on not rendering claims as facts.
 */
export async function GET() {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ rail: [], evidence: [] });
    }

    const recent = await prisma.evidence.findMany({
      where: { state: "VERIFIED", project: { tenantId: membership.tenantId } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        createdAt: true,
        creator: { select: { name: true, username: true } },
        project: { select: { title: true, slug: true } },
        reviews: {
          where: { decision: "APPROVED" },
          orderBy: { decidedAt: "desc" },
          take: 1,
          select: { decidedAt: true, reviewer: { select: { name: true } } },
        },
      },
    });

    const rail = recent.map((e) => ({
      kind: "idea" as const,
      id: e.id,
      title: e.project.title,
      slug: e.project.slug,
      type: SOURCE_LABEL[e.sourceType] ?? "Evidence added",
      detail: e.title,
      owner: e.creator.name,
      url: e.sourceUrl,
      // Provenance travels with the row. A stamp with no signer is decoration.
      verifiedBy: e.reviews[0]?.reviewer.name ?? null,
      verifiedAt: e.reviews[0]?.decidedAt?.toISOString() ?? null,
      time: formatTimeAgo(e.createdAt),
    }));

    return NextResponse.json({ rail, evidence: rail });
  } catch (error) {
    logger.error("Failed to fetch ledger rail", { error: String(error) });
    return NextResponse.json({ rail: [], evidence: [] });
  }
}
