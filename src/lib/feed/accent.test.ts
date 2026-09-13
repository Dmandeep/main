import { describe, expect, it } from "vitest";
import { FEED_KINDS, kindStyle } from "./accent";

/** Relative luminance, WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAPER = "#FAF7F2";

/** The stamp colours. A kind accent must never be mistaken for one of these. */
const STAMP = {
  verified: "#0F6B4F",
  pending: "#8A5A00",
  rejected: "#B3321F",
};

/** Crude hue distance, enough to catch "these two look the same". */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function hueGap(a: string, b: string): number {
  const raw = Math.abs(hue(a) - hue(b));
  return Math.min(raw, 360 - raw);
}

describe("kind accents", () => {
  it("covers every kind with a distinct colour", () => {
    const inks = FEED_KINDS.map((k) => kindStyle(k).ink);
    expect(new Set(inks).size).toBe(FEED_KINDS.length);
  });

  it("is readable on paper", () => {
    // The label and mark are drawn in `ink` on the page, so it carries text.
    for (const kind of FEED_KINDS) {
      expect(contrast(kindStyle(kind).ink, PAPER), kind).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("is readable on its own wash", () => {
    // The chip puts the same ink on the tinted surface, which is the lower
    // contrast pairing and the one that actually ships.
    for (const kind of FEED_KINDS) {
      const style = kindStyle(kind);
      expect(contrast(style.ink, style.wash), kind).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never sits close enough to a stamp colour to be mistaken for state", () => {
    // Colour here is identity. If a bounty's amber read as "pending", the card
    // would be making a claim about a verification state it knows nothing
    // about.
    for (const kind of FEED_KINDS) {
      const ink = kindStyle(kind).ink;
      for (const [name, stamp] of Object.entries(STAMP)) {
        expect(hueGap(ink, stamp), `${kind} vs ${name}`).toBeGreaterThan(25);
      }
    }
  });

  it("keeps the four kinds apart from each other", () => {
    // Two kinds a hue apart is the bug the whole module exists to fix.
    for (let i = 0; i < FEED_KINDS.length; i++) {
      for (let j = i + 1; j < FEED_KINDS.length; j++) {
        const a = kindStyle(FEED_KINDS[i]!).ink;
        const b = kindStyle(FEED_KINDS[j]!).ink;
        expect(hueGap(a, b), `${FEED_KINDS[i]} vs ${FEED_KINDS[j]}`).toBeGreaterThan(25);
      }
    }
  });

  it("falls back rather than throwing on an unknown kind", () => {
    expect(kindStyle("something-else").label).toBeTruthy();
  });

  it("labels every kind in words a student would use", () => {
    for (const kind of FEED_KINDS) {
      expect(kindStyle(kind).label.length, kind).toBeGreaterThan(2);
    }
  });
});
