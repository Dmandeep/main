import { describe, expect, it } from "vitest";
import { canonicalEmail, mapHeaders, parseCsv, parseRoster, suggestUsername } from "./parse";

/**
 * A bad roster import silently creating three accounts for one student is close
 * to impossible to unpick afterwards, so every rule that decides what gets
 * created is pinned here.
 */

const DOMAINS = ["lendi.org", "lendi.edu.in"];

function parse(csv: string, allowExternalDomains = false) {
  return parseRoster(csv, {
    allowedDomains: DOMAINS,
    defaultDepartment: "CSE",
    allowExternalDomains,
  });
}

describe("parseCsv", () => {
  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('name,note\n"Varma, Harshith","said ""yes"""');
    expect(rows[1]).toEqual(["Varma, Harshith", 'said "yes"']);
  });

  it("handles a newline inside a quoted field", () => {
    const rows = parseCsv('a,b\n"line one\nline two",x');
    expect(rows).toHaveLength(2);
    expect(rows[1]![0]).toBe("line one\nline two");
  });

  it("strips the BOM that Google Sheets exports add", () => {
    const rows = parseCsv("﻿Email,Name\na@lendi.org,A");
    expect(rows[0]![0]).toBe("Email");
  });

  it("drops blank rows rather than emitting empty records", () => {
    const rows = parseCsv("Email,Name\n\n\na@lendi.org,A\n\n");
    expect(rows).toHaveLength(2);
  });
});

describe("mapHeaders", () => {
  it("matches full Google Form question text, not just exact names", () => {
    const { mapping } = mapHeaders([
      "Timestamp",
      "What is your institutional email address?",
      "Full Name",
      "Which year of study are you in?",
    ]);
    expect(Object.values(mapping)).toContain("email");
    expect(Object.values(mapping)).toContain("name");
    expect(Object.values(mapping)).toContain("year");
  });

  it("reports headers it could not map instead of dropping them silently", () => {
    const { unmapped } = mapHeaders(["Email", "Name", "Favourite language"]);
    expect(unmapped).toContain("Favourite language");
  });

  it("never maps two columns to the same field", () => {
    const { mapping } = mapHeaders(["Email", "Email address", "Name"]);
    const fields = Object.values(mapping);
    expect(new Set(fields).size).toBe(fields.length);
  });
});

describe("parseRoster", () => {
  it("accepts a well-formed institutional row", () => {
    const r = parse("Email,Name,Year\nharshith@lendi.edu.in,Harshith Varma,3");
    expect(r.rejected).toHaveLength(0);
    expect(r.valid[0]).toMatchObject({
      email: "harshith@lendi.edu.in",
      name: "Harshith Varma",
      year: 3,
      role: "STUDENT",
      department: "CSE",
    });
  });

  it("lowercases the email so duplicates cannot slip through by case", () => {
    const r = parse("Email,Name\nHARSHITH@Lendi.Edu.In,H V");
    expect(r.valid[0]!.email).toBe("harshith@lendi.edu.in");
  });

  it("reads the messy year formats a form actually collects", () => {
    const r = parse(
      ["Email,Name,Year", "a@lendi.org,A,3rd", "b@lendi.org,B,II Year", "c@lendi.org,C, 4 "].join("\n")
    );
    expect(r.valid.map((v) => v.year)).toEqual([3, 2, 4]);
  });

  it("rejects a year it cannot read rather than guessing", () => {
    const r = parse("Email,Name,Year\na@lendi.org,A,final");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected[0]!.problems[0]).toMatchObject({ kind: "bad_year", value: "final" });
  });

  it("flags a duplicate inside the same file and names the earlier line", () => {
    const r = parse("Email,Name\na@lendi.org,A\na@lendi.org,A again");
    expect(r.valid).toHaveLength(1);
    expect(r.rejected[0]!.problems).toContainEqual({
      kind: "duplicate_in_file",
      firstSeenLine: 2,
    });
  });

  it("rejects rows missing an email or a name", () => {
    const r = parse("Email,Name\n,No Email\nb@lendi.org,");
    expect(r.valid).toHaveLength(0);
    expect(r.rejected.map((x) => x.problems[0]!.kind).sort()).toEqual([
      "missing_email",
      "missing_name",
    ]);
  });

  it("never grants privilege from a self-reported role column", () => {
    // A student filling in the form must not be able to type their way to
    // admin. Anything unrecognised falls back to STUDENT.
    const r = parse(
      ["Email,Name,Role", "a@lendi.org,A,superuser", "b@lendi.org,B,root", "c@lendi.org,C,"].join("\n")
    );
    expect(r.valid.map((v) => v.role)).toEqual(["STUDENT", "STUDENT", "STUDENT"]);
  });

  it("normalises a GitHub handle given as a URL or with an @", () => {
    const r = parse(
      ["Email,Name,GitHub", "a@lendi.org,A,@octocat", "b@lendi.org,B,https://github.com/torvalds"].join("\n")
    );
    expect(r.valid.map((v) => v.githubUsername)).toEqual(["octocat", "torvalds"]);
  });

  describe("domain allowlist", () => {
    it("rejects an outside domain when the allowlist is enforced", () => {
      const r = parse("Email,Name\nrandom@gmail.com,Outsider");
      expect(r.valid).toHaveLength(0);
      expect(r.rejected[0]!.problems[0]).toMatchObject({
        kind: "wrong_domain",
        value: "gmail.com",
      });
    });

    it("accepts an outside domain only when explicitly allowed", () => {
      // Forms often capture personal addresses, so this is opt-in per import.
      const r = parse("Email,Name\nrandom@gmail.com,Outsider", true);
      expect(r.valid).toHaveLength(1);
    });
  });
});

describe("suggestUsername", () => {
  it("derives from the local part and strips unsafe characters", () => {
    expect(suggestUsername("Harshith.Varma+tag@lendi.org")).toBe("harshithvarma");
  });

  it("always returns something usable", () => {
    expect(suggestUsername("!!!@lendi.org")).toBe("student");
  });
});

describe("plus-addressing", () => {
  it("treats a plus-addressed variant as the same mailbox", () => {
    expect(canonicalEmail("a+one@lendi.org")).toBe(canonicalEmail("a@lendi.org"));
  });

  it("catches a plus-addressed duplicate inside one file", () => {
    // Without this, one mailbox could claim two seats on the roster.
    const r = parse(
      ["Email,Name", "harshith@lendi.org,H", "harshith+second@lendi.org,H again"].join("\n")
    );
    expect(r.valid).toHaveLength(1);
    expect(r.rejected[0]!.problems).toContainEqual({
      kind: "duplicate_in_file",
      firstSeenLine: 2,
    });
  });

  it("keeps genuinely different addresses apart", () => {
    expect(canonicalEmail("a@lendi.org")).not.toBe(canonicalEmail("b@lendi.org"));
    expect(canonicalEmail("a@lendi.org")).not.toBe(canonicalEmail("a@lendi.edu.in"));
  });
});
