import { type Accent } from "@/lib/communities/palette";

/**
 * Colour and mark per feed kind.
 *
 * The mixed feed put a 10px grey label above every card and nothing else, so
 * four different things — a conversation, a piece of work, a seat, a job —
 * arrived as one undifferentiated column of beige. Scanning it meant reading
 * every card to find out what it was.
 *
 * Fixed, not hashed. Communities hash their accent because there are many and
 * they change; there are exactly four kinds here and they never change, so the
 * mapping is worth learning: aubergine is always a bounty.
 *
 * Hues are taken from the community palette, which is already tuned to sit on
 * warm paper and verified at 4.5:1 in its own tests. Four of the eight are
 * unusable here and the tests enforce why: moss and teal sit within 25 degrees
 * of `--stamp-verified`, and brick and amber clay sit within 25 of
 * `--stamp-rejected` and `--stamp-pending`. Amber was the obvious choice for a
 * bounty — reward, payment — and is 9.6 degrees from the pending stamp, which
 * would have made every bounty card read as a verification in progress.
 *
 * That leaves exactly four safe hues for exactly four kinds.
 */

export type FeedKind = "post" | "project" | "event" | "bounty";

export interface KindStyle extends Accent {
  /** What to call it, in the card's own voice. */
  label: string;
}

const KIND_STYLES: Record<FeedKind, KindStyle> = {
  // Slate blue — conversation.
  post: { label: "Discussion", ink: "#1F5E8C", wash: "#E7F0F7", edge: "#B7D2E6" },
  // Indigo — work being built.
  project: { label: "Project", ink: "#5B4B9A", wash: "#ECE9F7", edge: "#C8C0E6" },
  // Raspberry — something with a date on it.
  event: { label: "Event", ink: "#A8326B", wash: "#FAE9F1", edge: "#EDC2D7" },
  // Aubergine — work someone is asking for.
  bounty: { label: "Bounty", ink: "#7A3E9D", wash: "#F2EAF8", edge: "#D8C2E8" },
};

export function kindStyle(kind: string): KindStyle {
  return KIND_STYLES[kind as FeedKind] ?? KIND_STYLES.post;
}

export const FEED_KINDS = Object.keys(KIND_STYLES) as FeedKind[];
