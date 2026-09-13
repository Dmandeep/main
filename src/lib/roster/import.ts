import { createHash, randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseRoster, suggestUsername, type RejectedRow, type RosterRow } from "./parse";

/**
 * Roster import.
 *
 * Two phases on purpose: `planImport` computes what would happen and changes
 * nothing, `commitImport` applies a plan. An admin sees the exact outcome per
 * row before anything is written, because a bad roster import is one of the
 * few operations here that is genuinely painful to reverse.
 *
 * The import creates seats, never credentials. See ROSTER-ONBOARDING.md.
 */

export type RowOutcome =
  | { action: "create"; row: RosterRow; username: string }
  | { action: "attach"; row: RosterRow; userId: string; reason: string }
  | { action: "skip"; row: RosterRow; reason: string }
  | { action: "conflict"; row: RosterRow; reason: string };

export interface ImportPlan {
  tenantId: string;
  outcomes: RowOutcome[];
  rejected: RejectedRow[];
  unmappedHeaders: string[];
  summary: {
    rows: number;
    create: number;
    attach: number;
    skip: number;
    conflict: number;
    rejected: number;
  };
}

export interface PlanOptions {
  tenantId: string;
  csv: string;
  defaultDepartment?: string;
  allowExternalDomains?: boolean;
}

export async function planImport(options: PlanOptions): Promise<ImportPlan> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: options.tenantId },
    select: { id: true, name: true, institution: { select: { domains: true } } },
  });

  const parsed = parseRoster(options.csv, {
    allowedDomains: tenant.institution.domains,
    defaultDepartment: options.defaultDepartment ?? tenant.name,
    allowExternalDomains: options.allowExternalDomains ?? true,
  });

  const emails = parsed.valid.map((r) => r.email);

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      name: true,
      memberships: {
        where: { tenantId: tenant.id },
        select: { id: true, status: true, role: true },
      },
    },
  });
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  const pendingInvites = await prisma.invitation.findMany({
    where: { tenantId: tenant.id, email: { in: emails }, status: "PENDING" },
    select: { email: true },
  });
  const invited = new Set(pendingInvites.map((i) => i.email));

  // Usernames are globally unique, so collisions must be resolved against the
  // whole table, not just this file.
  const candidateUsernames = parsed.valid.map((r) => suggestUsername(r.email));
  const takenRows = await prisma.user.findMany({
    where: { username: { in: candidateUsernames } },
    select: { username: true },
  });
  const taken = new Set(takenRows.map((u) => u.username));

  const outcomes: RowOutcome[] = [];

  for (const row of parsed.valid) {
    const existing = userByEmail.get(row.email);

    if (existing) {
      const membership = existing.memberships[0];
      if (membership && membership.status === "ACTIVE") {
        outcomes.push({
          action: "skip",
          row,
          reason: `Already an active ${membership.role.toLowerCase()} in this department.`,
        });
        continue;
      }
      if (membership) {
        outcomes.push({
          action: "conflict",
          row,
          reason: `Account exists but its membership is ${membership.status.toLowerCase()}. Reinstate it manually rather than importing over it.`,
        });
        continue;
      }
      outcomes.push({
        action: "attach",
        row,
        userId: existing.id,
        reason: "Account already exists; adding a membership in this department.",
      });
      continue;
    }

    if (invited.has(row.email)) {
      outcomes.push({ action: "skip", row, reason: "An invitation is already pending." });
      continue;
    }

    let username = suggestUsername(row.email);
    for (let i = 1; taken.has(username); i++) {
      username = `${suggestUsername(row.email)}${i}`;
    }
    taken.add(username);

    outcomes.push({ action: "create", row, username });
  }

  const count = (a: RowOutcome["action"]) => outcomes.filter((o) => o.action === a).length;

  return {
    tenantId: tenant.id,
    outcomes,
    rejected: parsed.rejected,
    unmappedHeaders: parsed.unmappedHeaders,
    summary: {
      rows: parsed.valid.length + parsed.rejected.length,
      create: count("create"),
      attach: count("attach"),
      skip: count("skip"),
      conflict: count("conflict"),
      rejected: parsed.rejected.length,
    },
  };
}

/** A single-use invitation token and the hash that is stored for it. */
function mintToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: createHash("sha256").update(token).digest("hex") };
}

export interface CommitResult {
  importId: string;
  created: number;
  attached: number;
  skipped: number;
  conflicts: number;
  /** Plaintext tokens, returned once so invitation links can be sent. */
  invitations: Array<{ email: string; name: string; token: string; expiresAt: Date }>;
}

const INVITE_TTL_DAYS = 14;

export async function commitImport(
  plan: ImportPlan,
  actorId: string,
  filename: string
): Promise<CommitResult> {
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000);
  const invitations: CommitResult["invitations"] = [];

  let created = 0;
  let attached = 0;

  await prisma.$transaction(async (tx) => {
    for (const outcome of plan.outcomes) {
      if (outcome.action === "attach") {
        await tx.membership.create({
          data: {
            tenantId: plan.tenantId,
            userId: outcome.userId,
            role: outcome.row.role,
            department: outcome.row.department ?? null,
            year: outcome.row.year ?? null,
          },
        });
        attached++;
        continue;
      }

      if (outcome.action !== "create") continue;

      const { token, tokenHash } = mintToken();

      // No passwordHash. The seat exists; the student proves who they are by
      // signing in with the institutional Google account, or by accepting the
      // invitation link and choosing their own password. The admin never
      // handles a credential.
      const user = await tx.user.create({
        data: {
          email: outcome.row.email,
          name: outcome.row.name,
          username: outcome.username,
          githubUsername: outcome.row.githubUsername ?? null,
          githubVerified: false,
          memberships: {
            create: {
              tenantId: plan.tenantId,
              role: outcome.row.role,
              department: outcome.row.department ?? null,
              year: outcome.row.year ?? null,
            },
          },
        },
        select: { id: true },
      });

      await tx.invitation.create({
        data: {
          tenantId: plan.tenantId,
          email: outcome.row.email,
          name: outcome.row.name,
          role: outcome.row.role,
          department: outcome.row.department ?? null,
          year: outcome.row.year ?? null,
          tokenHash,
          expiresAt,
          acceptedById: user.id,
        },
      });

      invitations.push({ email: outcome.row.email, name: outcome.row.name, token, expiresAt });
      created++;
    }

    const record = await tx.rosterImport.create({
      data: {
        tenantId: plan.tenantId,
        actorId,
        filename,
        rowCount: plan.summary.rows,
        created,
        invited: invitations.length,
        skipped: plan.summary.skip,
        conflicts: plan.summary.conflict + plan.summary.rejected,
        // The per-row outcome is kept so an import can be explained later
        // without the original file.
        report: {
          summary: plan.summary,
          unmappedHeaders: plan.unmappedHeaders,
          outcomes: plan.outcomes.map((o) => ({
            line: o.row.line,
            email: o.row.email,
            action: o.action,
            reason: "reason" in o ? o.reason : null,
          })),
          rejected: plan.rejected.map((r) => ({ line: r.line, problems: r.problems })),
        },
      },
      select: { id: true },
    });

    await tx.auditLog.create({
      data: {
        tenantId: plan.tenantId,
        actorId,
        action: "roster.imported",
        targetType: "roster_import",
        targetId: record.id,
        diff: { filename, ...plan.summary },
      },
    });

    (commitImport as unknown as { _lastId?: string })._lastId = record.id;
  });

  return {
    importId: (commitImport as unknown as { _lastId?: string })._lastId ?? "",
    created,
    attached,
    skipped: plan.summary.skip,
    conflicts: plan.summary.conflict,
    invitations,
  };
}

/** Look up a pending invitation by its plaintext token. */
export async function findInvitation(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      expiresAt: true,
      acceptedById: true,
      tenantId: true,
    },
  });

  if (!invitation) return null;
  if (invitation.status !== "PENDING") return null;
  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    return null;
  }
  return invitation;
}

export function roleLabel(role: Role): string {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
