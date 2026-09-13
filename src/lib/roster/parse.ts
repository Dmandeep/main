import type { Role } from "@prisma/client";

/**
 * Roster CSV parsing and validation.
 *
 * Pure functions, no database: an import that silently creates three accounts
 * for one student is close to impossible to unpick afterwards, so the rules
 * that decide what gets created have to be testable without a database and
 * reviewable by someone who is not a programmer.
 *
 * Input is a Google Form response export. Column names are matched loosely
 * because Form question wording changes between semesters and an admin should
 * not have to rename headers by hand.
 */

export interface RosterRow {
  /** 1-based row number in the source file, for error messages. */
  line: number;
  email: string;
  name: string;
  role: Role;
  department?: string;
  year?: number;
  /** Self-reported. Never treated as proof of account ownership. */
  githubUsername?: string;
}

export type RowProblem =
  | { kind: "missing_email" }
  | { kind: "invalid_email"; value: string }
  | { kind: "wrong_domain"; value: string; allowed: string[] }
  | { kind: "missing_name" }
  | { kind: "bad_year"; value: string }
  | { kind: "duplicate_in_file"; firstSeenLine: number };

export interface RejectedRow {
  line: number;
  raw: Record<string, string>;
  problems: RowProblem[];
}

export interface ParseResult {
  valid: RosterRow[];
  rejected: RejectedRow[];
  /** Headers we could not map, so the admin can see what was ignored. */
  unmappedHeaders: string[];
}

/**
 * Header aliases. Google Forms headers are whole questions
 * ("What is your institutional email address?"), so matching is by substring
 * on a normalised header rather than by exact name.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  email: ["email", "e-mail", "mail id", "mailid"],
  name: ["name", "full name", "student name"],
  department: ["department", "branch", "dept"],
  year: ["year", "year of study", "current year", "studying year"],
  githubUsername: ["github", "git hub", "github username", "github handle"],
  role: ["role", "designation"],
};

function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s]+/g, " ").replace(/[?:.]/g, "");
}

/** Map each CSV header to a known field, or report it as unmapped. */
export function mapHeaders(headers: string[]): {
  mapping: Record<number, string>;
  unmapped: string[];
} {
  const mapping: Record<number, string> = {};
  const unmapped: string[] = [];
  const taken = new Set<string>();

  headers.forEach((header, index) => {
    const norm = normaliseHeader(header);
    let matched: string | null = null;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (taken.has(field)) continue;
      if (aliases.some((a) => norm === a || norm.includes(a))) {
        matched = field;
        break;
      }
    }

    if (matched) {
      mapping[index] = matched;
      taken.add(matched);
    } else if (header.trim()) {
      unmapped.push(header.trim());
    }
  });

  return { mapping, unmapped };
}

/**
 * Minimal RFC 4180 CSV reader: handles quoted fields, embedded commas,
 * embedded newlines and doubled quotes. Written out rather than pulled in as a
 * dependency because the input shape is narrow and the failure modes matter.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/^﻿/, ""); // strip BOM from Sheets exports

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim()));
}

const ROMAN_YEARS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
};

/** "III Year" -> 3. Returns NaN when there is no standalone roman numeral. */
function romanYear(value: string): number {
  for (const token of value.toLowerCase().split(/[^a-z]+/)) {
    const n = ROMAN_YEARS[token];
    if (n !== undefined) return n;
  }
  return NaN;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRole(value: string | undefined): Role {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "FACULTY" || v === "ADMIN" || v === "MENTOR" || v === "ALUMNI") return v;
  // Anything unrecognised becomes a student. Privilege is never granted by a
  // typo in a spreadsheet a student filled in themselves.
  return "STUDENT";
}

export interface ParseOptions {
  /** Institutional domains that may appear in the file. */
  allowedDomains: string[];
  /** Default department when the form did not ask. */
  defaultDepartment?: string;
  /** Allow external/personal domains (like gmail.com) if dumped from Google Forms */
  allowExternalDomains?: boolean;
}

export function parseRoster(text: string, options: ParseOptions): ParseResult {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    return { valid: [], rejected: [], unmappedHeaders: [] };
  }

  const [headerRow, ...dataRows] = rows;
  const { mapping, unmapped } = mapHeaders(headerRow!);

  const valid: RosterRow[] = [];
  const rejected: RejectedRow[] = [];
  const seenEmails = new Map<string, number>();
  const allowed = options.allowedDomains.map((d) => d.toLowerCase());

  dataRows.forEach((cells, i) => {
    const line = i + 2; // 1-based, plus the header row
    const raw: Record<string, string> = {};
    const field: Record<string, string> = {};

    cells.forEach((cell, index) => {
      const key = mapping[index];
      raw[headerRow![index] ?? `col${index}`] = cell;
      if (key) field[key] = cell.trim();
    });

    const problems: RowProblem[] = [];
    const email = (field.email ?? "").toLowerCase();
    const name = field.name ?? "";

    if (!email) {
      problems.push({ kind: "missing_email" });
    } else if (!EMAIL_RE.test(email)) {
      problems.push({ kind: "invalid_email", value: email });
    } else {
      const domain = email.split("@")[1]!;
      if (!options.allowExternalDomains && !allowed.includes(domain)) {
        problems.push({ kind: "wrong_domain", value: domain, allowed });
      }
      // Keyed on the canonical address so plus-addressed variants of one
      // mailbox collide instead of becoming separate accounts.
      const key = canonicalEmail(email);
      const first = seenEmails.get(key);
      if (first !== undefined) {
        problems.push({ kind: "duplicate_in_file", firstSeenLine: first });
      } else {
        seenEmails.set(key, line);
      }
    }

    if (!name) problems.push({ kind: "missing_name" });

    let year: number | undefined;
    if (field.year) {
      // Forms give "3", "3rd", "III Year", "Second". Arabic digits first, then
      // roman numerals, which are routine on Indian college forms and were
      // previously rejected outright. Anything else is refused rather than
      // guessed at.
      const digits = field.year.match(/\d+/);
      const parsed = digits ? Number(digits[0]) : romanYear(field.year);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 6) {
        year = parsed;
      } else {
        problems.push({ kind: "bad_year", value: field.year });
      }
    }

    if (problems.length > 0) {
      rejected.push({ line, raw, problems });
      return;
    }

    valid.push({
      line,
      email,
      name,
      role: parseRole(field.role),
      department: field.department || options.defaultDepartment,
      year,
      githubUsername: field.githubUsername
        ? field.githubUsername.replace(/^@/, "").replace(/^https?:\/\/github\.com\//, "").trim()
        : undefined,
    });
  });

  return { valid, rejected, unmappedHeaders: unmapped };
}

/**
 * Derive a unique username from an email local part.
 * Collisions are resolved by the caller against the database.
 */
export function suggestUsername(email: string): string {
  const base = normaliseLocalPart(email);
  return base || "student";
}

/**
 * The local part with plus-addressing removed.
 *
 * `a@x.org` and `a+anything@x.org` are the same mailbox, so treating them as
 * two people lets one address claim two seats on a roster.
 */
function normaliseLocalPart(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.split("+")[0]!.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * Canonical form of an address, for duplicate detection only. Never stored —
 * a student still signs in with the address they actually gave.
 */
export function canonicalEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return email.toLowerCase();
  return `${normaliseLocalPart(email)}@${domain}`;
}

/** Human-readable problem text for the admin's preview table. */
export function describeProblem(p: RowProblem): string {
  switch (p.kind) {
    case "missing_email":
      return "No email address in this row.";
    case "invalid_email":
      return `"${p.value}" is not a valid email address.`;
    case "wrong_domain":
      return `"${p.value}" is not an institutional domain (expected ${p.allowed.join(" or ")}).`;
    case "missing_name":
      return "No name in this row.";
    case "bad_year":
      return `Could not read "${p.value}" as a year of study.`;
    case "duplicate_in_file":
      return `Same email already appears on line ${p.firstSeenLine} of this file.`;
  }
}
