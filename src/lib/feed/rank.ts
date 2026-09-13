/**
 * Feed ranking.
 *
 * A pure function over already-fetched candidates, deliberately. The order a
 * student sees decides which work gets collaborators and which event gets
 * filled, so it has to be inspectable and testable without a database — and
 * explainable to someone who asks why their idea is not being seen.
 *
 * What this ranks on, and what it refuses to rank on:
 *
 *   - Evidence, not activity. A project with verified work outranks one with
 *     a busy comment thread. Ranking on engagement rewards whoever posts most,
 *     which on a campus is not the same people as whoever builds most.
 *
 *   - Freshness, with a floor. Everything decays, but a verified project does
 *     not fall off the feed simply for being a month old.
 *
 *   - Standing is never an input. Feeding the already-ranked more visibility
 *     is precisely the loop the newcomer quota exists to break, and it would
 *     undo it silently.
 *
 * Type weighting follows the department's stated priority — what your people
 * are saying, then what is happening soon, then what is being built, then what
 * is being asked for.
 */

export type FeedKind = "post" | "event" | "project" | "bounty";

export interface FeedCandidate {
  id: string;
  kind: FeedKind;
  createdAt: Date;
  /** Verified evidence attached to this item. Zero for most kinds. */
  verifiedEvidence?: number;
  /** When something happens or closes. Drives urgency, not recency. */
  happensAt?: Date | null;
  /** The viewer is a member of the community, project or event behind this. */
  viewerBelongs?: boolean;
  /** Reserved for newcomers, and the viewer is one. */
  reservedForViewer?: boolean;
  /** Pinned by a moderator. */
  pinned?: boolean;
}

export interface RankedItem<T extends FeedCandidate = FeedCandidate> {
  item: T;
  score: number;
  /** Why this scored what it did, for debugging and for explaining a feed. */
  reasons: string[];
}

/**
 * Base weight per kind.
 *
 * These are the department's ordering, not a claim about importance. Ordering
 * by kind alone would make the feed a set of stacked lists, so the weights are
 * close enough together that a strong item of one kind outranks a weak item of
 * a more favoured kind.
 */
const KIND_WEIGHT: Record<FeedKind, number> = {
  post: 1.0,
  event: 0.9,
  project: 0.8,
  bounty: 0.75,
};

/** Hours after which an item has lost half its freshness. */
const HALF_LIFE_HOURS = 36;

/**
 * The floor freshness decays to.
 *
 * Without it, verified work eventually scores zero and the feed becomes
 * whatever was posted today — which is how a record of what a campus built
 * turns back into a social feed.
 */
const FRESHNESS_FLOOR = 0.15;

/**
 * How much verified work is worth.
 *
 * Set so that a project with several verified pieces outranks a post made
 * minutes ago. That is the entire claim the product makes — evidence over
 * activity — and at a lower weight the claim is not true: a fresh post scores
 * 1.0, so anything under about 1.05 here leaves chatter on top of verified
 * work permanently.
 */
const EVIDENCE_WEIGHT = 1.2;

export function freshness(createdAt: Date, now: Date): number {
  const hours = Math.max((now.getTime() - createdAt.getTime()) / 3_600_000, 0);
  const decayed = Math.pow(0.5, hours / HALF_LIFE_HOURS);
  return Math.max(decayed, FRESHNESS_FLOOR);
}

/**
 * Urgency for something with a deadline.
 *
 * Peaks in the days before it happens and drops to nothing once it has. An
 * event a student can no longer attend is not news, however recently it was
 * announced.
 */
export function urgency(happensAt: Date | null | undefined, now: Date): number {
  if (!happensAt) return 0;

  const hoursAway = (happensAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursAway <= 0) return 0;
  if (hoursAway <= 48) return 1;
  if (hoursAway <= 168) return 0.6;
  if (hoursAway <= 336) return 0.3;
  return 0.1;
}

/**
 * Evidence weight, with diminishing returns.
 *
 * Linear weighting would let one large project dominate a feed permanently.
 * The curve means the first few pieces of verified work move an item a lot and
 * the twentieth moves it barely at all.
 */
export function evidenceWeight(verified: number | undefined): number {
  if (!verified || verified <= 0) return 0;
  return Math.log10(verified + 1);
}

export function scoreCandidate(candidate: FeedCandidate, now: Date): RankedItem {
  const reasons: string[] = [];

  const base = KIND_WEIGHT[candidate.kind];
  const fresh = freshness(candidate.createdAt, now);
  let score = base * fresh;
  reasons.push(`base ${base.toFixed(2)} × freshness ${fresh.toFixed(2)}`);

  const evidence = evidenceWeight(candidate.verifiedEvidence) * EVIDENCE_WEIGHT;
  if (evidence > 0) {
    score += evidence;
    reasons.push(`verified evidence +${evidence.toFixed(2)}`);
  }

  const soon = urgency(candidate.happensAt, now);
  if (soon > 0) {
    score += soon * 0.8;
    reasons.push(`happening soon +${(soon * 0.8).toFixed(2)}`);
  }

  if (candidate.viewerBelongs) {
    // Your own community's conversation beats a stranger's, but only by
    // enough to break a tie — a feed that only shows you your own rooms is
    // how a department stops knowing what the rest of it is doing.
    score += 0.35;
    reasons.push("yours +0.35");
  }

  if (candidate.reservedForViewer) {
    // A newcomer should see what is held open for them before it is gone.
    score += 0.5;
    reasons.push("reserved for you +0.50");
  }

  if (candidate.pinned) {
    score += 1.5;
    reasons.push("pinned +1.50");
  }

  return { item: candidate, score, reasons };
}

/**
 * Rank candidates, newest-first within equal scores.
 *
 * Ties break on recency and then on id, so the order is total and stable:
 * paging through a feed whose ties shuffle between requests shows the same
 * item twice and hides another entirely.
 */
export function rankFeed<T extends FeedCandidate>(
  candidates: readonly T[],
  now: Date = new Date()
): RankedItem<T>[] {
  return candidates
    .map((c) => scoreCandidate(c, now) as RankedItem<T>)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const byTime = b.item.createdAt.getTime() - a.item.createdAt.getTime();
      if (byTime !== 0) return byTime;
      return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
    });
}

/**
 * Stop one kind from taking the whole page.
 *
 * Scoring alone can hand every top slot to posts on a busy day, which buries
 * the event closing tonight. This walks the ranked list and defers any item
 * that would exceed the cap within a window, rather than dropping it.
 */
export function diversify<T extends FeedCandidate>(
  ranked: readonly RankedItem<T>[],
  { windowSize = 5, maxPerKind = 3 }: { windowSize?: number; maxPerKind?: number } = {}
): RankedItem<T>[] {
  const out: RankedItem<T>[] = [];
  const pending = [...ranked];

  const atCap = (entry: RankedItem<T>) =>
    out.slice(-windowSize).filter((e) => e.item.kind === entry.item.kind).length >= maxPerKind;

  while (pending.length > 0) {
    // The highest-scoring item whose kind has room in the current window.
    let pick = pending.findIndex((entry) => !atCap(entry));

    // Nothing is eligible, which means only over-represented kinds are left.
    // The cap then relaxes rather than the remainder being dumped at the end:
    // deferring forever would reorder the tail into a worse order than simply
    // continuing by score.
    if (pick === -1) pick = 0;

    out.push(pending[pick]!);
    pending.splice(pick, 1);
  }

  return out;
}
