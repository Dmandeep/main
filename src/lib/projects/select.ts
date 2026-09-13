import { Prisma } from "@prisma/client";
import { userRefSelect } from "@/lib/tenant";

/**
 * One canonical projection for a project in a list.
 *
 * Every feed, profile tab and search result reads this, so no handler can
 * accidentally ship a field the client does not expect — or omit one it does.
 */
export const projectCardSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  problem: true,
  track: true,
  tags: true,
  skillsNeeded: true,
  coverImage: true,
  status: true,
  briefCompleteness: true,
  upvoteCount: true,
  verifiedEvidenceCount: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: userRefSelect },
  members: {
    where: { leftAt: null },
    select: { role: true, user: { select: userRefSelect } },
  },
} satisfies Prisma.ProjectSelect;

export type ProjectCardRow = Prisma.ProjectGetPayload<{ select: typeof projectCardSelect }>;

/**
 * Serialise to the shape the client components already consume.
 *
 * The API speaks `_id` because the existing client types do. That is a
 * deliberate compatibility shim during the Mongo-to-Postgres port, not a
 * long-term contract — see the follow-up note in docs/adr/0001.
 */
export function toProjectCard(p: ProjectCardRow) {
  return {
    _id: p.id,
    slug: p.slug,
    title: p.title,
    tagline: p.tagline ?? undefined,
    problem: p.problem,
    track: p.track,
    tags: p.tags,
    skillsNeeded: p.skillsNeeded,
    coverImage: p.coverImage ?? undefined,
    status: p.status.toLowerCase(),
    healthScore: p.briefCompleteness,
    briefCompleteness: p.briefCompleteness,
    upvotes: p.upvoteCount,
    verifiedEvidenceCount: p.verifiedEvidenceCount,
    createdAt: p.createdAt.toISOString(),
    owner: {
      _id: p.owner.id,
      name: p.owner.name,
      username: p.owner.username,
      avatarUrl: p.owner.avatarUrl ?? undefined,
    },
    collaborators: p.members
      .filter((m) => m.user.id !== p.owner.id)
      .map((m) => ({
        _id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl ?? undefined,
      })),
  };
}
