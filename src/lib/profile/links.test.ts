import { describe, expect, it } from "vitest";
import {
  PLATFORM_KEYS,
  isVerifiable,
  normaliseHandle,
  platformLabel,
  profileUrl,
  showsAsVerified,
} from "./links";

describe("normaliseHandle", () => {
  it("takes the username out of a pasted profile URL", () => {
    // This is what students actually paste, and storing it raw produces
    // links like github.com/https://github.com/someone.
    expect(normaliseHandle("github", "https://github.com/torvalds")).toBe("torvalds");
    expect(normaliseHandle("leetcode", "https://leetcode.com/u/someone/")).toBe("someone");
    expect(normaliseHandle("linkedin", "https://www.linkedin.com/in/someone/")).toBe("someone");
    expect(normaliseHandle("codeforces", "https://codeforces.com/profile/tourist")).toBe("tourist");
    expect(normaliseHandle("reddit", "https://www.reddit.com/user/someone/")).toBe("someone");
  });

  it("strips leading at-signs and trailing slashes", () => {
    expect(normaliseHandle("x", "@someone")).toBe("someone");
    expect(normaliseHandle("github", "someone/")).toBe("someone");
    expect(normaliseHandle("github", "  someone  ")).toBe("someone");
  });

  it("leaves a personal site as the URL it is", () => {
    expect(normaliseHandle("personal_site", "https://example.org/about")).toBe(
      "https://example.org/about"
    );
  });

  it("returns empty for empty input rather than throwing", () => {
    expect(normaliseHandle("github", "")).toBe("");
    expect(normaliseHandle("github", "   ")).toBe("");
  });

  it("survives something that is not a parseable URL", () => {
    expect(normaliseHandle("github", "http://")).toBe("");
  });
});

describe("profileUrl", () => {
  it("builds the right URL per platform", () => {
    expect(profileUrl("github", "torvalds")).toBe("https://github.com/torvalds");
    expect(profileUrl("leetcode", "someone")).toBe("https://leetcode.com/u/someone/");
    expect(profileUrl("codechef", "someone")).toBe("https://www.codechef.com/users/someone");
    expect(profileUrl("geeksforgeeks", "someone")).toBe(
      "https://www.geeksforgeeks.org/user/someone/"
    );
  });

  it("normalises before building, so a pasted URL still round-trips", () => {
    expect(profileUrl("github", "https://github.com/torvalds")).toBe("https://github.com/torvalds");
  });

  it("gives a personal site a scheme when it has none", () => {
    expect(profileUrl("personal_site", "example.org")).toBe("https://example.org");
    expect(profileUrl("personal_site", "https://example.org")).toBe("https://example.org");
  });

  it("returns null for Discord, which has no public profile URL", () => {
    // Rendering a link here would send people to a 404.
    expect(profileUrl("discord", "someone")).toBeNull();
  });

  it("returns null for an unknown platform or an empty handle", () => {
    expect(profileUrl("myspace", "someone")).toBeNull();
    expect(profileUrl("github", "")).toBeNull();
  });

  it("escapes a handle that would otherwise change the path", () => {
    // A handle is untrusted input. Without encoding, "a/../b" walks the URL.
    const url = profileUrl("github", "a b");
    expect(url).toBe("https://github.com/a%20b");
  });
});

describe("verification", () => {
  it("treats only GitHub as verifiable", () => {
    // It is the only platform with an OAuth round trip proving ownership.
    expect(isVerifiable("github")).toBe(true);
    for (const key of PLATFORM_KEYS.filter((k) => k !== "github")) {
      expect(isVerifiable(key), key).toBe(false);
    }
  });

  it("refuses to show a non-GitHub link as verified even if the row says so", () => {
    // A verified flag on a platform with no proof path is a data error. The UI
    // must not launder it into something students read as a fact.
    expect(showsAsVerified("leetcode", true)).toBe(false);
    expect(showsAsVerified("github", true)).toBe(true);
    expect(showsAsVerified("github", false)).toBe(false);
  });
});

describe("platform catalogue", () => {
  it("covers every platform the schema offers", () => {
    // Kept in step with the LinkPlatform enum by hand; this fails loudly if
    // one is added there and forgotten here.
    expect(PLATFORM_KEYS.sort()).toEqual(
      [
        "codechef",
        "codeforces",
        "discord",
        "geeksforgeeks",
        "github",
        "hackerrank",
        "leetcode",
        "linkedin",
        "personal_site",
        "reddit",
        "x",
      ].sort()
    );
  });

  it("labels every platform readably", () => {
    for (const key of PLATFORM_KEYS) {
      expect(platformLabel(key), key).not.toBe(key);
    }
  });

  it("falls back to the raw value for an unknown platform", () => {
    expect(platformLabel("myspace")).toBe("myspace");
  });
});
