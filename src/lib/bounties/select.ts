import { Prisma } from "@prisma/client";
import { userRefSelect } from "@/lib/tenant";
import type { ClaimEligibility } from "./eligibility";

export { claimEligibility } from "./eligibility";
export type { ClaimBlockReason, ClaimContext, ClaimEligibility } from "./eligibility";

/**
 * Bounty detail projection.
 *
 * A bounty list row answers "should I look at this?"; the detail answers
 * "can I claim it, what exactly is being asked, and what happened to everyone
 * else who tried?". The second question is the one the list cannot answer, so
 * the detail carries submissions, claim state and eligibility.
 */
export const bountyDetailSelect = {
  id: true,
  title: true,
  description: true,
  kind: true,
  track: true,
  skillsNeeded: true,
  rewardPoints: true,
  reservedForNewcomers: true,
  maxClaims: true,
  status: true,
  opensAt: true,
  closesAt: true,
  createdAt: true,
  poster: { select: { ...userRefSelect, bio: true } },
  submissions: {
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      summary: true,
      status: true,
      reviewNote: true,
      submittedAt: true,
      awardedAt: true,
      evidenceIds: true,
      user: { select: userRefSelect },
    },
  },
} satisfies Prisma.BountySelect;

export type BountyDetailRow = Prisma.BountyGetPayload<{ select: typeof bountyDetailSelect }>;

export function serialiseBountyDetail(
  b: BountyDetailRow,
  eligibility: ClaimEligibility,
  viewerIsNewcomer: boolean
) {
  const awarded = b.submissions.filter((s) => s.status === "AWARDED").length;
  const open = b.submissions.filter((s) => s.status === "SUBMITTED").length;

  return {
    _id: b.id,
    title: b.title,
    description: b.description,
    kind: b.kind.toLowerCase(),
    track: b.track ?? undefined,
    skillsNeeded: b.skillsNeeded,
    rewardPoints: b.rewardPoints,
    reservedForNewcomers: b.reservedForNewcomers,
    maxClaims: b.maxClaims,
    placesLeft: Math.max(b.maxClaims - b.submissions.length, 0),
    status: b.status.toLowerCase(),
    opensAt: b.opensAt.toISOString(),
    closesAt: b.closesAt?.toISOString() ?? null,
    createdAt: b.createdAt.toISOString(),
    postedBy: {
      _id: b.poster.id,
      name: b.poster.name,
      username: b.poster.username,
      avatarUrl: b.poster.avatarUrl ?? undefined,
      bio: b.poster.bio ?? undefined,
    },
    counts: { total: b.submissions.length, awarded, open },
    submissions: b.submissions.map((s) => ({
      _id: s.id,
      summary: s.summary,
      status: s.status.toLowerCase(),
      reviewNote: s.reviewNote ?? undefined,
      submittedAt: s.submittedAt.toISOString(),
      awardedAt: s.awardedAt?.toISOString() ?? null,
      evidenceCount: s.evidenceIds.length,
      user: {
        _id: s.user.id,
        name: s.user.name,
        username: s.user.username,
        avatarUrl: s.user.avatarUrl ?? undefined,
      },
    })),
    viewer: { ...eligibility, isNewcomer: viewerIsNewcomer },
  };
}
