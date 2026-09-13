import { prisma } from "@/lib/prisma";

/**
 * Rebuild `Project.verifiedEvidenceCount` from the evidence rows.
 *
 * The counter is denormalised so that sorting a feed by verified work is one
 * indexed column rather than a correlated count. Denormalised counters drift:
 * the only writer was the verification handler, so any path that created
 * verified evidence another way — a seed, a backfill, a migration — left every
 * project reading zero. That is not a cosmetic bug: `/api/ideas?sort=trending`
 * and `sort=evidence` both order by this column, so they were ordering by a
 * constant.
 *
 * This is the reconciler. Run it after any bulk write, and periodically, the
 * same way standing is recomputed from its ledger.
 */
export async function reconcileEvidenceCounts(tenantId?: string): Promise<{
  projectsChecked: number;
  projectsCorrected: number;
  drifted: { id: string; title: string; was: number; now: number }[];
}> {
  const projects = await prisma.project.findMany({
    where: tenantId ? { tenantId } : {},
    select: {
      id: true,
      title: true,
      verifiedEvidenceCount: true,
      _count: { select: { evidence: { where: { state: "VERIFIED" } } } },
    },
  });

  const drifted: { id: string; title: string; was: number; now: number }[] = [];

  for (const project of projects) {
    const actual = project._count.evidence;
    if (actual === project.verifiedEvidenceCount) continue;

    drifted.push({
      id: project.id,
      title: project.title,
      was: project.verifiedEvidenceCount,
      now: actual,
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { verifiedEvidenceCount: actual },
    });
  }

  return {
    projectsChecked: projects.length,
    projectsCorrected: drifted.length,
    drifted,
  };
}
