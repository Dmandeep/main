# ADR 0001 — Freeze the datastore on PostgreSQL

- **Status:** Accepted
- **Date:** 2026-09-11
- **Supersedes:** `docs/legacy/IDEASPACE_ULTRA_MASTER_PROMPT_MONGODB.md` (MongoDB Atlas / Mongoose mandate)

## Context

The repository carried three contradictory datastore stories at once:

| Source | Datastore |
|---|---|
| `src/lib/database.ts`, `package.json` (`mongoose`, `mongodb`, `@auth/mongodb-adapter`) | MongoDB Atlas |
| `docs/legacy/IDEASPACE_ULTRA_MASTER_PROMPT_MONGODB.md` | MongoDB Atlas (mandated) |
| `docs/legacy/prisma/schema.prisma` + committed `dev.db` | Prisma + SQLite |
| `docs/spec/2026-05-03-ideaspace-full-product-design.md` | Firebase / Firestore |

Feature work continued while the architecture was still moving. That is the root cause of
the `any`-cast commits, the duplicated app scaffold, and the drift between README and reality.

The domain model is relational, not document-shaped:

- campus/tenant scoping on every read and write (`tenant_id`);
- unique membership per `(tenant_id, user_id)`;
- many-to-many project membership with join/leave intervals;
- an **append-only** reputation ledger with idempotency keys and a materialized balance;
- evidence rows pointing at both a project and an external source, with provenance and content hash;
- verification reviews referencing a reviewer and an evidence row;
- audit logs and institutional reporting queries that span all of the above.

Enforcing these in MongoDB means enforcing them in application code. Every one of those
invariants becomes a place where a bug silently produces wrong institutional records — the
exact thing the product is meant to be trusted for.

## Decision

**PostgreSQL is the datastore. The decision is frozen. No further work may reopen it.**

- ORM: Prisma. `docs/legacy/prisma/schema.prisma` is the starting point, not the final model.
- Auth adapter moves from `@auth/mongodb-adapter` to the Prisma adapter.
- Tenant isolation is enforced at the database layer (row-level policies where the host
  supports them) in addition to tenant-scoped query functions — never by route middleware alone.
- Reputation is stored as an immutable `reputation_events` ledger plus a materialized balance.
  A mutable `points` total is not an acceptable source of truth.

## Scope boundary

This ADR **freezes the decision**. It does not perform the migration.

- Now (Week 1, repo hygiene): datastore is decided and recorded; contradicting docs are moved
  under `docs/legacy/`; no runtime code changes.
- Week 2: schema, migrations, data backfill, adapter swap, query-layer rewrite.

Until the Week 2 migration lands, MongoDB remains the running store. `.env.example` therefore
still lists `MONGODB_URI`.

## Consequences

**Accepted costs**

- A migration of every model in `src/models` and every query in `src/lib` and `src/app/api`.
- NextAuth adapter swap, which touches the session and account tables.
- Several weeks of work that produce no new user-visible features.

**What it buys**

- Cross-tenant leakage becomes a constraint violation instead of a code review miss.
- Reporting and analytics (the institutional buyer's actual deliverable) become plain SQL.
- Point-farming and double-award bugs are prevented by unique idempotency keys.
- Evidence provenance gets real referential integrity.

## Rejected alternatives

- **Stay on MongoDB.** Fastest to ship. Rejected: every relational invariant above stays
  enforced only in application code, and the product's entire claim is that its records are
  trustworthy.
- **Firebase/Firestore** (per the May 2026 design doc). Rejected: same relational objection,
  plus a second vendor migration and weaker query support for institutional reporting.
- **Defer the decision again.** Rejected: deferral is what produced the current drift.
