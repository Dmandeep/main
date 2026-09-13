import { describe, expect, it } from "vitest";
import { canonicalSkill, isMatch, matchLabel, matchSkills, normaliseSkill } from "./matching";

describe("normaliseSkill", () => {
  it("ignores case, spacing and the punctuation people type", () => {
    expect(normaliseSkill("  React  ")).toBe("react");
    expect(normaliseSkill("Node.js")).toBe("node js");
    expect(normaliseSkill("UI/UX")).toBe("ui ux");
  });

  it("keeps the characters that are part of a name", () => {
    // Dropping these would turn C++ into C and C# into C, which are three
    // different answers to "can you do this".
    expect(normaliseSkill("C++")).toBe("c++");
    expect(normaliseSkill("C#")).toBe("c#");
  });

  it("returns empty for input with nothing in it", () => {
    expect(normaliseSkill("   ")).toBe("");
    expect(normaliseSkill("!!!")).toBe("");
  });
});

describe("canonicalSkill", () => {
  it("folds the common ways of writing one skill", () => {
    expect(canonicalSkill("JS")).toBe("javascript");
    expect(canonicalSkill("ReactJS")).toBe("react");
    expect(canonicalSkill("UI/UX")).toBe("design");
    expect(canonicalSkill("Postgres")).toBe("postgresql");
  });

  it("leaves anything it does not know alone", () => {
    expect(canonicalSkill("Rust")).toBe("rust");
  });
});

describe("matchSkills", () => {
  it("finds what a person covers", () => {
    const match = matchSkills(["React", "Postgres", "Figma"], ["reactjs", "rust"]);
    expect(match.matched).toEqual(["React"]);
    expect(match.asked).toHaveLength(3);
  });

  it("returns the project's own wording, not the normalised form", () => {
    // The card shows this back to a student; "They need React" reads right and
    // "They need react" reads like a bug.
    expect(matchSkills(["Machine Learning"], ["ml"]).matched).toEqual(["Machine Learning"]);
  });

  it("does not match on a prefix", () => {
    // "react" matching "reactor" is the kind of wrong match that stops people
    // trusting the feature at all.
    expect(matchSkills(["Reactor physics"], ["react"]).matched).toEqual([]);
  });

  it("handles a project asking for nothing", () => {
    expect(matchSkills([], ["react"]).matched).toEqual([]);
    expect(isMatch([], ["react"])).toBe(false);
  });

  it("handles a person listing nothing", () => {
    expect(matchSkills(["React"], []).matched).toEqual([]);
    expect(isMatch(["React"], [])).toBe(false);
  });

  it("ignores blank entries on either side", () => {
    expect(matchSkills(["React", "  ", ""], ["react", ""]).asked).toEqual(["React"]);
  });

  it("does not double-count a skill listed twice", () => {
    const match = matchSkills(["React"], ["react", "ReactJS", "REACT"]);
    expect(match.matched).toEqual(["React"]);
  });
});

describe("matchLabel", () => {
  it("says nothing when there is no match", () => {
    expect(matchLabel({ matched: [], asked: ["React"] })).toBeNull();
  });

  it("names the one thing when there is one", () => {
    expect(matchLabel({ matched: ["React"], asked: ["React", "Figma"] })).toBe("They need React");
  });

  it("names one and counts the rest when there are several", () => {
    expect(
      matchLabel({ matched: ["React", "Figma", "Rust"], asked: ["React", "Figma", "Rust"] })
    ).toBe("They need React and 2 more you listed");
  });
});
