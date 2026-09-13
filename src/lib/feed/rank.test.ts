import { describe, expect, it } from "vitest";
import {
  type FeedCandidate,
  diversify,
  evidenceWeight,
  freshness,
  rankFeed,
  scoreCandidate,
  urgency,
} from "./rank";

const NOW = new Date("2026-09-12T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const hoursAhead = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

function candidate(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return { id: "a", kind: "post", createdAt: NOW, ...over };
}

describe("freshness", () => {
  it("halves over the half-life", () => {
    expect(freshness(NOW, NOW)).toBeCloseTo(1, 5);
    expect(freshness(hoursAgo(36), NOW)).toBeCloseTo(0.5, 5);
    expect(freshness(hoursAgo(72), NOW)).toBeCloseTo(0.25, 5);
  });

  it("never decays below the floor", () => {
    // Otherwise verified work eventually scores zero and the record of what a
    // campus built turns back into whatever was posted today.
    expect(freshness(hoursAgo(24 * 365), NOW)).toBe(0.15);
  });

  it("does not reward an item dated in the future", () => {
    expect(freshness(hoursAhead(100), NOW)).toBeCloseTo(1, 5);
  });
});

describe("urgency", () => {
  it("is highest in the last two days", () => {
    expect(urgency(hoursAhead(6), NOW)).toBe(1);
    expect(urgency(hoursAhead(47), NOW)).toBe(1);
  });

  it("falls off as the date recedes", () => {
    expect(urgency(hoursAhead(100), NOW)).toBe(0.6);
    expect(urgency(hoursAhead(300), NOW)).toBe(0.3);
    expect(urgency(hoursAhead(1000), NOW)).toBe(0.1);
  });

  it("is zero once it has happened", () => {
    // An event a student can no longer attend is not news.
    expect(urgency(hoursAgo(1), NOW)).toBe(0);
    expect(urgency(null, NOW)).toBe(0);
    expect(urgency(undefined, NOW)).toBe(0);
  });
});

describe("evidenceWeight", () => {
  it("is zero with nothing verified", () => {
    expect(evidenceWeight(0)).toBe(0);
    expect(evidenceWeight(undefined)).toBe(0);
  });

  it("has diminishing returns", () => {
    const first = evidenceWeight(1) - evidenceWeight(0);
    const twentieth = evidenceWeight(20) - evidenceWeight(19);
    expect(first).toBeGreaterThan(twentieth);
  });

  it("keeps rising, so more verified work is never a penalty", () => {
    expect(evidenceWeight(10)).toBeGreaterThan(evidenceWeight(3));
  });
});

describe("scoring", () => {
  it("puts verified work above a fresher item with none", () => {
    const verified = scoreCandidate(
      candidate({ id: "old-verified", kind: "project", createdAt: hoursAgo(72), verifiedEvidence: 8 }),
      NOW
    );
    const chatter = scoreCandidate(candidate({ id: "new-post", kind: "post" }), NOW);
    expect(verified.score).toBeGreaterThan(chatter.score);
  });

  it("never uses standing as an input", () => {
    // Feeding visibility to the already-ranked is the loop the newcomer quota
    // exists to break. Two items differing only in a standing-like field must
    // score identically — the type has no such field, and this asserts that
    // adding one would have to be deliberate.
    const a = scoreCandidate(candidate({ id: "a" }), NOW);
    const b = scoreCandidate(candidate({ id: "b" }), NOW);
    expect(a.score).toBe(b.score);
  });

  it("lifts something reserved for the viewer", () => {
    const reserved = scoreCandidate(
      candidate({ kind: "bounty", reservedForViewer: true }),
      NOW
    );
    const open = scoreCandidate(candidate({ kind: "bounty" }), NOW);
    expect(reserved.score).toBeGreaterThan(open.score);
  });

  it("lifts an event happening soon over one far away", () => {
    const soon = scoreCandidate(
      candidate({ kind: "event", happensAt: hoursAhead(12) }),
      NOW
    );
    const distant = scoreCandidate(
      candidate({ kind: "event", happensAt: hoursAhead(900) }),
      NOW
    );
    expect(soon.score).toBeGreaterThan(distant.score);
  });

  it("does not let belonging alone bury everything else", () => {
    // A feed that only shows you your own rooms is how a department stops
    // knowing what the rest of it is doing.
    const mine = scoreCandidate(candidate({ kind: "post", viewerBelongs: true, createdAt: hoursAgo(72) }), NOW);
    const theirs = scoreCandidate(candidate({ kind: "post", createdAt: NOW }), NOW);
    expect(theirs.score).toBeGreaterThan(mine.score);
  });

  it("explains itself", () => {
    const scored = scoreCandidate(
      candidate({ kind: "project", verifiedEvidence: 3, pinned: true }),
      NOW
    );
    expect(scored.reasons.join(" ")).toContain("verified evidence");
    expect(scored.reasons.join(" ")).toContain("pinned");
  });
});

describe("rankFeed", () => {
  it("orders by score descending", () => {
    const ranked = rankFeed(
      [
        candidate({ id: "stale", createdAt: hoursAgo(500) }),
        candidate({ id: "fresh", createdAt: NOW }),
      ],
      NOW
    );
    expect(ranked.map((r) => r.item.id)).toEqual(["fresh", "stale"]);
  });

  it("is a total order, so paging cannot repeat or skip an item", () => {
    const tied = [
      candidate({ id: "b", createdAt: NOW }),
      candidate({ id: "a", createdAt: NOW }),
      candidate({ id: "c", createdAt: NOW }),
    ];
    expect(rankFeed(tied, NOW).map((r) => r.item.id)).toEqual(["a", "b", "c"]);
    // Same input in a different order must rank identically.
    expect(rankFeed([...tied].reverse(), NOW).map((r) => r.item.id)).toEqual(["a", "b", "c"]);
  });

  it("handles an empty feed", () => {
    expect(rankFeed([], NOW)).toEqual([]);
  });
});

describe("diversify", () => {
  it("pulls a buried event up past a run of posts", () => {
    const posts = Array.from({ length: 6 }, (_, i) =>
      candidate({ id: `p${i}`, kind: "post", createdAt: hoursAgo(i) })
    );
    // On score alone this event sorts last; the whole point is that a busy day
    // of posts must not bury the thing happening soon.
    const event = candidate({ id: "e", kind: "event", createdAt: hoursAgo(200) });

    const out = diversify(rankFeed([...posts, event], NOW), { windowSize: 5, maxPerKind: 3 });
    expect(out.findIndex((r) => r.item.id === "e")).toBeLessThanOrEqual(3);
  });

  it("holds the cap while another kind is still available", () => {
    const posts = Array.from({ length: 6 }, (_, i) =>
      candidate({ id: `p${i}`, kind: "post", createdAt: hoursAgo(i) })
    );
    const events = Array.from({ length: 3 }, (_, i) =>
      candidate({ id: `e${i}`, kind: "event", createdAt: hoursAgo(200 + i) })
    );

    const out = diversify(rankFeed([...posts, ...events], NOW), { windowSize: 5, maxPerKind: 3 });
    for (let i = 0; i + 5 <= out.length; i++) {
      const window = out.slice(i, i + 5).map((r) => r.item.kind);
      const posts = window.filter((k) => k === "post").length;
      // The cap may only be exceeded once nothing else is left to place.
      const eventsLeftAfter = out.slice(i + 5).filter((r) => r.item.kind === "event").length;
      if (eventsLeftAfter > 0) expect(posts, `window at ${i}`).toBeLessThanOrEqual(3);
    }
  });

  it("defers rather than drops", () => {
    const posts = Array.from({ length: 8 }, (_, i) =>
      candidate({ id: `p${i}`, kind: "post", createdAt: hoursAgo(i) })
    );
    const out = diversify(rankFeed(posts, NOW), { windowSize: 5, maxPerKind: 3 });
    expect(out).toHaveLength(8);
    expect(new Set(out.map((r) => r.item.id)).size).toBe(8);
  });

  it("leaves a already-mixed feed alone", () => {
    const mixed = rankFeed(
      [
        candidate({ id: "a", kind: "post" }),
        candidate({ id: "b", kind: "event", happensAt: hoursAhead(10) }),
        candidate({ id: "c", kind: "project", verifiedEvidence: 2 }),
      ],
      NOW
    );
    expect(diversify(mixed).map((r) => r.item.id)).toEqual(mixed.map((r) => r.item.id));
  });
});
