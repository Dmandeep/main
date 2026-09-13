import { describe, expect, it } from "vitest";
import { ACCENTS, accentFor, authorAccent, initialsOf, kindAccent } from "./palette";

/**
 * Colour here is identity, not decoration, so the properties that matter are
 * stability and contrast — both of which are easy to break silently.
 */

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAPER = "#FAF7F2";

describe("accent contrast", () => {
  it("every accent clears WCAG AA on paper", () => {
    // These colours carry names and labels, so they are body text and must
    // clear 4.5:1 — not the 3:1 that large text would allow.
    for (const accent of ACCENTS) {
      const ratio = contrast(accent.ink, PAPER);
      expect(ratio, `${accent.ink} on paper is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps ink readable on its own wash", () => {
    for (const accent of ACCENTS) {
      const ratio = contrast(accent.ink, accent.wash);
      expect(ratio, `${accent.ink} on ${accent.wash}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses washes light enough to sit on paper without becoming a block", () => {
    for (const accent of ACCENTS) {
      expect(luminance(accent.wash)).toBeGreaterThan(0.7);
    }
  });
});

describe("stability", () => {
  it("gives the same key the same colour every time", () => {
    // A colour that changes on refresh is noise; one that holds is recognition.
    const first = accentFor("community:open-source");
    for (let i = 0; i < 50; i++) {
      expect(accentFor("community:open-source")).toEqual(first);
    }
  });

  it("keeps a person the same colour in every room", () => {
    expect(authorAccent("user_123")).toEqual(authorAccent("user_123"));
  });

  it("separates different keys", () => {
    const seen = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((k) => accentFor(k).ink)
    );
    // Not a guarantee of uniqueness — a hash into 8 buckets collides — but a
    // single colour for ten keys would mean the hash is broken.
    expect(seen.size).toBeGreaterThan(3);
  });

  it("never returns undefined, including for empty input", () => {
    expect(accentFor("")).toBeDefined();
    expect(accentFor("")!.ink).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe("kindAccent", () => {
  it("gives each community kind a fixed colour", () => {
    const kinds = ["department", "batch", "project", "interest", "event"];
    for (const k of kinds) {
      expect(kindAccent(k)).toEqual(kindAccent(k));
    }
    // Kinds are a category a reader learns once, so they must not collide.
    const inks = new Set(kinds.map((k) => kindAccent(k).ink));
    expect(inks.size).toBe(kinds.length);
  });

  it("falls back rather than throwing on an unknown kind", () => {
    expect(kindAccent("something-new").ink).toMatch(/^#/);
  });
});

describe("initialsOf", () => {
  it("takes first and last initials", () => {
    expect(initialsOf("Harshith Varma")).toBe("HV");
    expect(initialsOf("Dr. A. Rao")).toBe("DR");
  });

  it("handles a single name and extra whitespace", () => {
    expect(initialsOf("Prashanth")).toBe("PR");
    expect(initialsOf("  Ananya   Reddy  ")).toBe("AR");
  });

  it("never returns an empty string", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});
