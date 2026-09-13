/**
 * External profile links.
 *
 * A student's standing on this platform is earned here and verified here. The
 * links are the opposite: unverified claims about accounts elsewhere. Keeping
 * the two visually distinct is the whole point — a profile that renders a
 * typed-in LeetCode rank the same way it renders a verified ledger entry
 * teaches people that neither number means anything.
 *
 * Only GitHub can currently be verified, because only GitHub has an OAuth
 * round trip that proves the account belongs to this person. Everything else
 * says "claimed" until someone builds that proof.
 */

/** Lowercased platform names, matching the serialised `LinkPlatform` enum. */
export type PlatformKey =
  | "github"
  | "linkedin"
  | "leetcode"
  | "codeforces"
  | "codechef"
  | "hackerrank"
  | "geeksforgeeks"
  | "reddit"
  | "discord"
  | "personal_site"
  | "x";

interface PlatformSpec {
  label: string;
  /** Builds the public URL, or null where the platform has no public profile. */
  url: (handle: string) => string | null;
  /** What a stat on this platform usually means, shown as placeholder help. */
  statHint: string;
}

const SPECS: Record<PlatformKey, PlatformSpec> = {
  github: {
    label: "GitHub",
    url: (h) => `https://github.com/${encodeURIComponent(h)}`,
    statHint: "Repositories, contributions",
  },
  linkedin: {
    label: "LinkedIn",
    url: (h) => `https://www.linkedin.com/in/${encodeURIComponent(h)}`,
    statHint: "Headline",
  },
  leetcode: {
    label: "LeetCode",
    url: (h) => `https://leetcode.com/u/${encodeURIComponent(h)}/`,
    statHint: "Problems solved, contest rating",
  },
  codeforces: {
    label: "Codeforces",
    url: (h) => `https://codeforces.com/profile/${encodeURIComponent(h)}`,
    statHint: "Rating, rank",
  },
  codechef: {
    label: "CodeChef",
    url: (h) => `https://www.codechef.com/users/${encodeURIComponent(h)}`,
    statHint: "Stars, rating",
  },
  hackerrank: {
    label: "HackerRank",
    url: (h) => `https://www.hackerrank.com/profile/${encodeURIComponent(h)}`,
    statHint: "Badges, certificates",
  },
  geeksforgeeks: {
    label: "GeeksforGeeks",
    url: (h) => `https://www.geeksforgeeks.org/user/${encodeURIComponent(h)}/`,
    statHint: "Problems solved, score",
  },
  reddit: {
    label: "Reddit",
    url: (h) => `https://www.reddit.com/user/${encodeURIComponent(h)}/`,
    statHint: "Karma",
  },
  discord: {
    // Discord has no public profile URL for a username, so this renders as
    // text to copy rather than a link that would 404.
    label: "Discord",
    url: () => null,
    statHint: "Server, role",
  },
  personal_site: {
    label: "Website",
    url: (h) => (/^https?:\/\//i.test(h) ? h : `https://${h}`),
    statHint: "What it is",
  },
  x: {
    label: "X",
    url: (h) => `https://x.com/${encodeURIComponent(h)}`,
    statHint: "Followers",
  },
};

export const PLATFORM_KEYS = Object.keys(SPECS) as PlatformKey[];

export function platformLabel(platform: string): string {
  return SPECS[platform as PlatformKey]?.label ?? platform;
}

export function platformStatHint(platform: string): string {
  return SPECS[platform as PlatformKey]?.statHint ?? "";
}

/**
 * Strip what people actually paste.
 *
 * Students paste whole profile URLs, `@handles`, and trailing slashes far more
 * often than they type a bare username. Normalising here means the stored
 * handle is always the thing the URL builder expects, rather than producing
 * links like `github.com/https://github.com/someone`.
 */
export function normaliseHandle(platform: string, raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // A personal site is a URL, not a handle: leave it alone apart from spacing.
  if (platform === "personal_site") return trimmed;

  let handle = trimmed;

  if (/^https?:\/\//i.test(handle)) {
    try {
      const url = new URL(handle);
      const segments = url.pathname.split("/").filter(Boolean);
      // The last non-empty segment is the username on every platform here
      // (…/u/name, …/in/name, …/user/name, …/profile/name, …/name).
      handle = segments.at(-1) ?? "";
    } catch {
      // It announced itself as a URL and is not one. Keeping the raw text
      // would store junk like "http:" and build a link to nowhere, so this
      // yields nothing and the caller rejects it as empty.
      handle = "";
    }
  }

  return handle.replace(/^@+/, "").replace(/\/+$/, "").trim();
}

/** The public URL for a handle, or null where the platform has none. */
export function profileUrl(platform: string, handle: string): string | null {
  const spec = SPECS[platform as PlatformKey];
  if (!spec) return null;

  const clean = normaliseHandle(platform, handle);
  if (!clean) return null;

  return spec.url(clean);
}

/**
 * Whether a link may be shown as verified.
 *
 * Deliberately not just `link.isVerified`: verification means an OAuth round
 * trip actually happened, and GitHub is the only platform wired for one. A row
 * flagged verified on any other platform is a data error, and rendering it as
 * a fact would launder that error into a claim students trust.
 */
export function isVerifiable(platform: string): boolean {
  return platform === "github";
}

export function showsAsVerified(platform: string, isVerified: boolean): boolean {
  return isVerified && isVerifiable(platform);
}
