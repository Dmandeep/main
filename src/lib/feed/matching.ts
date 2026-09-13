/**
 * Matching people to work that needs them.
 *
 * A campus platform fails quietly when a student who can do the thing never
 * finds the project that needs it. Both sides are already on record here —
 * projects list `skillsNeeded`, students list tags — so the match is available
 * and was simply never made.
 *
 * Deliberately a pure function over strings. The rule that decides whose work
 * gets shown to whom should be readable by the student it affects, not buried
 * in a query.
 *
 * What this refuses to do:
 *
 *   - Rank by standing. A match is about capability, not rank; sorting by
 *     points here would hand every collaboration to the people who already
 *     have the most.
 *   - Score partial credit for near-misses. "react" matching "reactor" makes
 *     the feature look broken in exactly the way that stops people trusting
 *     it, so matching is on whole normalised tokens only.
 */

/** Lowercase, trim, and collapse the punctuation people actually type. */
export function normaliseSkill(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[._/\\]+/g, " ")
    .replace(/[^a-z0-9+# ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Common ways students write the same skill.
 *
 * Kept small and explicit. A fuzzy matcher would pair things that are not the
 * same thing, and the cost of a wrong match here is a student being told they
 * are wanted for work they cannot do.
 */
const ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  reactjs: "react",
  nextjs: "next",
  node: "nodejs",
  postgres: "postgresql",
  ui: "design",
  ux: "design",
  "ui ux": "design",
  ml: "machine learning",
  ai: "machine learning",
  iot: "embedded",
  cpp: "c++",
};

export function canonicalSkill(raw: string): string {
  const clean = normaliseSkill(raw);
  return ALIASES[clean] ?? clean;
}

export interface SkillMatch {
  /** The skills the project asked for that this person has. */
  matched: string[];
  /** Everything the project asked for. */
  asked: string[];
}

/**
 * Which of a project's needs this person covers.
 *
 * Returns the overlap rather than a score: "you have 2 of the 3 things this
 * team is looking for" is something a student can act on, where "match: 0.67"
 * is not.
 */
export function matchSkills(
  skillsNeeded: readonly string[],
  viewerSkills: readonly string[]
): SkillMatch {
  const mine = new Set(viewerSkills.map(canonicalSkill).filter(Boolean));

  const asked = skillsNeeded.filter((s) => normaliseSkill(s).length > 0);
  const matched = asked.filter((need) => mine.has(canonicalSkill(need)));

  return { matched, asked };
}

/** Does this project want anything this person has? */
export function isMatch(
  skillsNeeded: readonly string[],
  viewerSkills: readonly string[]
): boolean {
  return matchSkills(skillsNeeded, viewerSkills).matched.length > 0;
}

/**
 * How to say it.
 *
 * Phrased as what the team is missing rather than as a score, because the
 * sentence has to work on a card a student reads in one second.
 */
export function matchLabel(match: SkillMatch): string | null {
  if (match.matched.length === 0) return null;

  if (match.matched.length === 1) {
    return `They need ${match.matched[0]}`;
  }

  const [first, ...rest] = match.matched;
  return `They need ${first} and ${rest.length} more you listed`;
}
