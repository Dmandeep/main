import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import {
  can,
  canApproveMembership,
  canVerifyEvidence,
  capabilitiesOf,
  isStaff,
  rolesWith,
} from "./permissions";

const ALL_ROLES: Role[] = ["STUDENT", "FACULTY", "HOD", "ADMIN", "MENTOR", "ALUMNI"];

describe("four-eyes separation", () => {
  it("stops an HOD verifying evidence", () => {
    // The whole point of the role split: whoever grants someone a role must
    // not also be able to validate the work that role produces.
    expect(canVerifyEvidence("HOD")).toBe(false);
    expect(canApproveMembership("HOD")).toBe(true);
  });

  it("stops faculty granting memberships", () => {
    expect(canVerifyEvidence("FACULTY")).toBe(true);
    expect(canApproveMembership("FACULTY")).toBe(false);
  });

  it("means no single non-admin role can both enrol and verify", () => {
    const both = ALL_ROLES.filter(
      (r) => r !== "ADMIN" && canApproveMembership(r) && canVerifyEvidence(r)
    );
    expect(both).toEqual([]);
  });

  it("documents ADMIN as the deliberate exception", () => {
    // Admin holds both so a stalled pilot can be unblocked. That is a known
    // trade-off, not an oversight — if this assertion ever fails, the model
    // changed and the audit story needs revisiting.
    expect(canApproveMembership("ADMIN") && canVerifyEvidence("ADMIN")).toBe(true);
  });
});

describe("students", () => {
  it("hold no capabilities at all", () => {
    expect(capabilitiesOf("STUDENT")).toEqual([]);
  });

  it("cannot reach any privileged action", () => {
    for (const c of [
      "VERIFY_EVIDENCE",
      "APPROVE_MEMBERSHIP",
      "MANAGE_ROSTER",
      "ALLOCATE_SEATS",
      "MODERATE",
      "POST_OPPORTUNITY",
      "VIEW_REPORTS",
    ] as const) {
      expect(can("STUDENT", c), c).toBe(false);
    }
  });
});

describe("outside roles", () => {
  it("lets mentors and alumni post opportunities and nothing else", () => {
    for (const role of ["MENTOR", "ALUMNI"] as const) {
      expect(capabilitiesOf(role)).toEqual(["POST_OPPORTUNITY"]);
      expect(can(role, "MODERATE")).toBe(false);
      expect(can(role, "VERIFY_EVIDENCE")).toBe(false);
    }
  });

  it("does not count them as staff", () => {
    expect(isStaff("MENTOR")).toBe(false);
    expect(isStaff("ALUMNI")).toBe(false);
    expect(isStaff("STUDENT")).toBe(false);
    expect(isStaff("FACULTY")).toBe(true);
    expect(isStaff("HOD")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
  });
});

describe("roster management", () => {
  it("is held only by HOD and ADMIN", () => {
    // Creating accounts is the highest-leverage action in the system.
    expect(rolesWith("MANAGE_ROSTER").sort()).toEqual(["ADMIN", "HOD"]);
  });
});

describe("model integrity", () => {
  it("covers every role in the enum", () => {
    for (const role of ALL_ROLES) {
      expect(Array.isArray(capabilitiesOf(role)), role).toBe(true);
    }
  });

  it("never lists a capability twice for one role", () => {
    for (const role of ALL_ROLES) {
      const caps = capabilitiesOf(role);
      expect(new Set(caps).size, role).toBe(caps.length);
    }
  });

  it("keeps at least one role able to verify, or the ledger can never move", () => {
    expect(rolesWith("VERIFY_EVIDENCE").length).toBeGreaterThan(0);
  });
});
