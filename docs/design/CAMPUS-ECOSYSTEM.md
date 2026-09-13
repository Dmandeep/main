# The Campus Ecosystem — scope decisions

**Date:** 11 September 2026
**Status:** Accepted. Drives `prisma/schema.prisma`.

---

## 1. The thesis

Today, standing in IdeaSpace is vanity. Nothing happens when a student has points, which is why the audit scored *"students care about rank"* as **not enough evidence**.

Make standing **spendable**:

```
verified contribution  ->  standing  ->  access to scarce campus resources  ->  more contribution
```

A college has genuinely scarce things: seats in limited workshops, travel and registration funding, lab and makerspace budget, faculty mentor hours, alumni introductions, incubation slots, and the real prize — who represents the college externally.

> **IdeaSpace is a campus allocation system backed by a verified contribution ledger.**

No competitor in the audited set does allocation. ProjectHub, QWAD, SkillLinkr, ProofLabAI and UniSync all do discovery plus profile. Allocation requires institutional authority, which is exactly the moat the audit says is needed and exactly what a consumer clone cannot reproduce.

## 2. Six requested features, one system

| Requested | What it actually is | Side of the loop |
|---|---|---|
| Student projects | the record | evidence supply |
| Scores and ranks | standing, derived from the ledger | the meter |
| Bounty system | institution, faculty and alumni injecting demand | demand in |
| Voting for events | participatory budgeting for what campus runs next | demand priority |
| Event access for ranked | entitlements — standing converted into a seat | the spend |
| Junior / senior / alumni / faculty | mentor hours and project handoff | scarce supply |

Not six modules. One economy: **record -> standing -> claim -> spend -> record.**

Bounties matter structurally, not as a side feature: completing one *produces evidence*, which makes them the fastest way to populate a cold ledger on a campus with no history.

## 3. What each role gets

- **Junior** — a way in that does not require already knowing people. Claim a starter bounty, get verified, take a reserved seat.
- **Senior** — standing that converts into real things, and a clean handoff so the project survives graduation.
- **Alumni** — bounded, countable asks. Not "please mentor students" indefinitely, but "4 mentor hours this month, one bounty funded, three evidence items reviewed." Vague asks are why alumni programmes decay.
- **Faculty / IIC** — allocation stops being a WhatsApp argument and becomes a defensible, auditable decision with provenance attached.
- **Institution** — outcomes per programme, per department, per semester.

## 4. Decisions taken

| Question | Decision | Consequence |
|---|---|---|
| Does standing gate resources in v1? | **No — record-only** | Entitlement tables exist in the schema but nothing spends standing yet. Trust the ledger before anything depends on it. |
| Pilot owner | **One department** | Tenant = department inside an institution. Keeps roster size honest; a second department onboards with no data migration. |
| Money | **Points and entitlements only** | No payment rails, no KYC, no payouts, no tax treatment, no dispute handling. Rewards are standing and non-cash scarce resources. |

## 5. Four problems this design creates, and the fixes

### 5.1 Freshman lockout
Access needs standing, standing needs verified work, verified work needs access. First-years get locked out of exactly the events that would earn them standing. Cold-start trap, and regressive.

**Fixes, in the schema now:**
- `CampusEvent.newcomerQuotaPercent`, default 40 — a fixed share of every event's capacity is held for students below the low-standing threshold.
- `EventRegistration.allocation` records *how* each seat was obtained, so honouring the quota is provable rather than asserted.
- `Bounty.reservedForNewcomers` and `BountyKind.STARTER` — a claimable first build for anyone with no history.

### 5.2 Gaming becomes worth it
Points are cosmetic today, so nobody farms them. The moment standing buys a hackathon seat, farming pays.

**Fixes:**
- `ReputationEvent.idempotencyKey`, unique per tenant — awarding the same thing twice is a constraint violation, not a bug discovered later in a leaderboard.
- `Evidence` unique on `(projectId, sourceType, sourceExternalId)` — resubmitting the same commit is rejected by the database.
- Reversals are negative rows (`ABUSE_REVERSAL`) linked via `reversedById`. Nothing is ever deleted.
- `Season` scoping, so standing is per-semester and final-years cannot permanently crowd out everyone below them.

### 5.3 Legitimacy
An algorithm deciding who gets funding **will** be challenged, by a student or a parent.

**Fixes:** published rules; provenance on every point (the drawer from the art direction); `EntitlementGrant.decidedById` and `.rationale` so a person owns every decision; `AuditLog.diff` for anything that changed a score or a decision. The system is decision *support*. Faculty decide.

### 5.4 Faculty bottleneck
More gating means more verification load, and the audit already flagged faculty refusing to moderate as a critical risk.

**Fixes:** `Evidence.extractionConfidence` and `EvidenceState.MACHINE_VERIFIED` so machines clear the easy cases; humans see only ambiguous or high-stakes items; verification SLA held in `Tenant.settings` and surfaced in the Review Bench.

## 6. Scope line

**Build:** identity and roster, projects, evidence, verification, standing ledger, bounties, demand voting, entitlements and seat allocation, mentorship, handoff and revival, admin analytics.

**Integrate, never rebuild:** ERP/LMS identity (SSO plus roster import), GitHub, calendar, email.

**Never build:** attendance, fees, exams and grades, timetable, hostel, library, transport, payroll.

That last row is where "digitalizing college" kills the product. Competing with entrenched ERP vendors on their own ground means procurement cycles measured in years, and it stops IdeaSpace being the innovation ledger.

"Smart campus" is a positioning word. **"The campus's record of what it built, and how it decides who gets what next"** is a product.

## 7. One rule that is not negotiable

**Standing never buys influence over what the campus runs.**

`EventDemandVote` is unique on `(eventId, userId)` — one person, one vote. Weighting votes by standing would hand agenda control to the already-ranked and guarantee that first-years never get the sessions they most need. Standing affects *seat priority* in phase 3. It never affects vote weight.

## 8. Build phases

Each phase ships something usable on its own.

1. **Spine** — roster and SSO, projects, evidence, verification, standing ledger with provenance. No allocation. Nothing downstream means anything until this is trustworthy.
2. **Demand** — bounties and event demand voting. Populates a cold ledger fast.
3. **Allocation** — entitlements, seat allocation with reserved quotas, funding requests, appeals.
4. **Network** — alumni mentor hours, project handoff and revival, employer view.

## 9. Information architecture impact

None. The five destinations from the art direction absorb all of this:

- Bounties, events and demand voting live under **CAMPUS**.
- Standing, and later what it unlocks, lives under **PEOPLE**.
- **LEDGER** is unchanged and remains the centre of gravity.

A seat allocation is just another ledger entry with provenance, so `Ledger Line`, `Provenance Stamp` and `Provenance Drawer` are reused verbatim.
