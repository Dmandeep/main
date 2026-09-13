/**
 * Accent palette for social surfaces.
 *
 * The Ledger direction — paper, ink, one stamp colour — is right for records:
 * restraint reads as credibility on an evidence page. Applied to a chat room
 * it reads as dull, because a community is a place people spend time in and
 * compare to Discord, not a filing cabinet.
 *
 * So the system gets an accent family rather than an exception. Every hue here
 * is chosen to sit on warm paper without fighting the ink: mid-saturation,
 * darkened enough to clear 4.5:1 on `--paper-0`, and muted enough that eight of
 * them in one list still look like one product. No neon, no gradients.
 *
 * Colour here is identity, never state. State stays with the stamp colours, so
 * a community being teal can never be confused with something being verified.
 */

export interface Accent {
  /** Readable on paper: used for names, icons and labels. */
  ink: string;
  /** Tinted surface behind an avatar or chip. */
  wash: string;
  /** Hairline / ring. */
  edge: string;
}

/**
 * Eight hues, evenly spaced round the wheel but hand-tuned rather than
 * generated, so none of them lands on the stamp colours and gets mistaken for
 * a verification state.
 */
export const ACCENTS: readonly Accent[] = [
  { ink: "#1F5E8C", wash: "#E7F0F7", edge: "#B7D2E6" }, // slate blue
  { ink: "#7A3E9D", wash: "#F2EAF8", edge: "#D8C2E8" }, // aubergine
  { ink: "#A8326B", wash: "#FAE9F1", edge: "#EDC2D7" }, // raspberry
  { ink: "#9A5B1E", wash: "#F8EEE2", edge: "#E8CFB0" }, // amber clay
  { ink: "#2F6E4F", wash: "#E6F1EB", edge: "#BBD8C8" }, // moss
  { ink: "#1C6E73", wash: "#E3F1F2", edge: "#B2D8DA" }, // teal
  { ink: "#5B4B9A", wash: "#ECE9F7", edge: "#C8C0E6" }, // indigo ink
  { ink: "#8C3A2E", wash: "#F8EAE7", edge: "#E8C3BB" }, // brick
] as const;

/**
 * Stable hash so a given community or person keeps the same colour forever,
 * across reloads, devices and everyone's screen. A colour that changes on
 * refresh is noise; one that holds becomes recognition.
 */
function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function accentFor(key: string): Accent {
  return ACCENTS[hash(key) % ACCENTS.length]!;
}

/**
 * Author colour inside a conversation.
 *
 * Keyed on the person, not their position in the list, so someone is the same
 * colour in every room — the property that makes a wall of text scannable.
 */
export function authorAccent(userId: string): Accent {
  return accentFor(`author:${userId}`);
}

/** Per-community identity colour. */
export function communityAccent(slug: string): Accent {
  return accentFor(`community:${slug}`);
}

/**
 * Community kinds carry a fixed colour rather than a hashed one: the kind is
 * a category with meaning, and a reader should learn it once.
 */
export const KIND_ACCENT: Record<string, Accent> = {
  department: ACCENTS[0]!,
  batch: ACCENTS[6]!,
  project: ACCENTS[4]!,
  interest: ACCENTS[1]!,
  event: ACCENTS[3]!,
};

export function kindAccent(kind: string): Accent {
  return KIND_ACCENT[kind] ?? ACCENTS[0]!;
}

/** Initials for an avatar, capped at two characters. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
