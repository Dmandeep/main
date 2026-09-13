import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { isNewcomer } from "@/lib/standing/rules";
import { type FeedCandidate, diversify, rankFeed } from "@/lib/feed/rank";

/**
 * The mixed feed.
 *
 * Four sources — community posts, events, projects and bounties — pulled with
 * a generous but bounded cap each, then ranked and interleaved in one place.
 * Ranking in the database instead would mean four different ORDER BY clauses
 * that cannot see each other, which is how a "feed" becomes four stacked lists
 * with a shared scrollbar.
 *
 * The cap per source is deliberate: this reads a bounded working set and ranks
 * it in memory rather than paging a union query. At department scale that is
 * the simpler correct thing; at a scale where it is not, the ranking function
 * is pure and can move to a materialised table without changing behaviour.
 */

const PER_SOURCE = 40;
const PAGE = 30;

export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? String(PAGE), 10) || PAGE, 50);

    const standing = await prisma.standing.findUnique({
      where: { membershipId: membership.membershipId },
      select: { points: true },
    });
    const viewerIsNewcomer = isNewcomer(standing?.points ?? 0);

    // Which communities the viewer is actually in, so "yours" means something.
    const myCommunities = await prisma.communityMember.findMany({
      where: { userId: membership.userId, leftAt: null },
      select: { communityId: true },
    });
    const mine = new Set(myCommunities.map((m) => m.communityId));

    const [posts, events, projects, bounties] = await Promise.all([
      prisma.post.findMany({
        where: {
          tenantId: membership.tenantId,
          removedAt: null,
          // A post in a private community the viewer is not in must not appear
          // in a feed. Filtering after the query is how that leaks.
          OR: [
            { communityId: null },
            { community: { visibility: { in: ["CAMPUS", "REQUEST_TO_JOIN"] } } },
            { community: { members: { some: { userId: membership.userId, leftAt: null } } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          body: true,
          kind: true,
          createdAt: true,
          pinnedAt: true,
          communityId: true,
          author: { select: { name: true, username: true, avatarUrl: true } },
          community: { select: { slug: true, name: true } },
          project: { select: { slug: true, title: true } },
        },
      }),

      prisma.campusEvent.findMany({
        where: { tenantId: membership.tenantId, status: { in: ["SCHEDULED", "PROPOSED"] } },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          title: true,
          description: true,
          kind: true,
          status: true,
          startsAt: true,
          location: true,
          capacity: true,
          createdAt: true,
          _count: { select: { demandVotes: true } },
          registrations: {
            where: { status: { in: ["REGISTERED", "ATTENDED"] } },
            select: { id: true },
          },
        },
      }),

      prisma.project.findMany({
        where: { tenantId: membership.tenantId, status: { not: "DRAFT" } },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          track: true,
          status: true,
          createdAt: true,
          verifiedEvidenceCount: true,
          upvoteCount: true,
          ownerId: true,
          owner: { select: { name: true, username: true, avatarUrl: true } },
          members: { where: { userId: membership.userId, leftAt: null }, select: { id: true } },
          // The viewer's own vote, so the card can render its state rather
          // than guessing and correcting after the first tap.
          votes: { where: { userId: membership.userId }, select: { id: true } },
        },
      }),

      prisma.bounty.findMany({
        where: { tenantId: membership.tenantId, status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: PER_SOURCE,
        select: {
          id: true,
          title: true,
          description: true,
          kind: true,
          rewardPoints: true,
          reservedForNewcomers: true,
          closesAt: true,
          createdAt: true,
          poster: { select: { name: true, username: true } },
        },
      }),
    ]);

    // Candidates carry only what ranking needs; the payload is kept alongside
    // so the pure function never has to know about presentation.
    const payloads = new Map<string, unknown>();
    const candidates: FeedCandidate[] = [];

    for (const p of posts) {
      const key = `post:${p.id}`;
      candidates.push({
        id: key,
        kind: "post",
        createdAt: p.createdAt,
        viewerBelongs: p.communityId ? mine.has(p.communityId) : false,
        pinned: p.pinnedAt !== null,
      });
      payloads.set(key, {
        _id: p.id,
        type: "post",
        body: p.body,
        postKind: p.kind.toLowerCase(),
        author: p.author,
        community: p.community,
        project: p.project,
        createdAt: p.createdAt.toISOString(),
        pinned: p.pinnedAt !== null,
      });
    }

    for (const e of events) {
      const key = `event:${e.id}`;
      candidates.push({
        id: key,
        kind: "event",
        createdAt: e.createdAt,
        happensAt: e.startsAt,
      });
      payloads.set(key, {
        _id: e.id,
        type: "event",
        title: e.title,
        description: e.description,
        eventKind: e.kind.toLowerCase(),
        status: e.status.toLowerCase(),
        startsAt: e.startsAt?.toISOString() ?? null,
        location: e.location ?? undefined,
        capacity: e.capacity,
        seatsHeld: e.registrations.length,
        seatsLeft: e.capacity === null ? null : Math.max(e.capacity - e.registrations.length, 0),
        demandVotes: e._count.demandVotes,
        createdAt: e.createdAt.toISOString(),
      });
    }

    for (const p of projects) {
      const key = `project:${p.id}`;
      candidates.push({
        id: key,
        kind: "project",
        createdAt: p.createdAt,
        verifiedEvidence: p.verifiedEvidenceCount,
        viewerBelongs: p.members.length > 0,
      });
      payloads.set(key, {
        _id: p.id,
        type: "project",
        slug: p.slug,
        title: p.title,
        tagline: p.tagline,
        track: p.track,
        status: p.status.toLowerCase(),
        verifiedEvidenceCount: p.verifiedEvidenceCount,
        upvotes: p.upvoteCount,
        viewerHasUpvoted: p.votes.length > 0,
        // Upvoting your own project is refused by the handler; saying so on
        // the card avoids offering an action that will be rejected.
        viewerIsOwner: p.ownerId === membership.userId,
        owner: p.owner,
        createdAt: p.createdAt.toISOString(),
      });
    }

    for (const b of bounties) {
      const key = `bounty:${b.id}`;
      candidates.push({
        id: key,
        kind: "bounty",
        createdAt: b.createdAt,
        happensAt: b.closesAt,
        reservedForViewer: b.reservedForNewcomers && viewerIsNewcomer,
      });
      payloads.set(key, {
        _id: b.id,
        type: "bounty",
        title: b.title,
        description: b.description,
        bountyKind: b.kind.toLowerCase(),
        rewardPoints: b.rewardPoints,
        reservedForNewcomers: b.reservedForNewcomers,
        // Shown only where it is true for this viewer: a reserved badge on a
        // bounty they cannot claim is an advert for a door that is shut.
        reservedForViewer: b.reservedForNewcomers && viewerIsNewcomer,
        closesAt: b.closesAt?.toISOString() ?? null,
        poster: b.poster,
        createdAt: b.createdAt.toISOString(),
      });
    }

    const ranked = diversify(rankFeed(candidates));

    return NextResponse.json({
      data: ranked.slice(0, limit).map((entry) => ({
        ...(payloads.get(entry.item.id) as Record<string, unknown>),
        _score: Number(entry.score.toFixed(3)),
      })),
      meta: {
        counts: {
          posts: posts.length,
          events: events.length,
          projects: projects.length,
          bounties: bounties.length,
        },
        returned: Math.min(ranked.length, limit),
      },
    });
  } catch (error) {
    logger.error("Failed to build the feed", { error: String(error) });
    return NextResponse.json({ error: "Failed to load the feed" }, { status: 500 });
  }
}
