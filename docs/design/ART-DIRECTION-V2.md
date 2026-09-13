# IdeaSpace — Art Direction & Design System v2
## "The Ledger"

**Status:** Proposed. Supersedes `docs/spec/DESIGN.md` on acceptance.
**Date:** 11 September 2026

---

## 1. Research: what was actually examined

| Source | Method | Access |
|---|---|---|
| projecthubstudents.com | fetched, full copy read | yes |
| prooflabai.com | fetched, full copy read | yes |
| qwad.in | loaded in browser, screenshotted, scrolled | yes |
| awwwards.com/websites/sites_of_the_day | fetched | yes |
| by-kin.com | fetched | yes |
| hontran.dev (Awwwards juror, 2026 review) | fetched | yes |
| goodui.org | fetched (test metrics paywalled) | partial |
| Open Badges 3.0 / W3C VC | searched, spec summaries read | yes |
| GitHub contribution-graph criticism | searched | yes |
| India budget-device / network baseline | searched | yes |
| **mobbin.com** | **browser returned 403 Forbidden** | **no access** |
| pageflows.com, uxarchive.com, reallygoodux.io | not attempted | no |

Nothing below is attributed to a source that was not opened.

### 1.1 The category's visual reality

All three closest competitors occupy one lane.

**QWAD** (screenshotted): near-black `#0A0A0A` canvas. Centred sans headline, roughly 72px, "Find your people. / Build something that matters." Purple pill CTA. Gradient category chips. A `0+ builders` counter that renders literally as zero before hydration.

**ProjectHub**: single-column vertical stack, sans throughout, emoji as iconography, sectioned "The Problem / The Fix / How It Works / Features". Cards carry name, category, stage, roles needed. Headline: "Find your team. Show what you're building."

**ProofLabAI**: light, modular, three audience lanes (Students / Colleges / Startups), full-width dashboard screenshot as credibility device. Headline: "Build Real-World Proof. Land Real Internships." Trust Score plus XP.

**IdeaSpace today** is in the same lane, harder: `--surface-base: #0A0A0F`, `--brand-primary: #6366F1` (indigo), `--brand-secondary: #8B5CF6` (violet), plus `.aurora-bg`, `.dot-grid`, `.noise`, four glass utilities, two glow families, four gradient-text utilities, `.animate-float`, `.animate-pulse-glow`, `.animate-spin-slow`.

> **The finding that drives everything else:** if a student opens QWAD and IdeaSpace in two tabs, the only way to tell them apart is by reading. That is a positioning failure expressed in CSS.

### 1.2 What the 2026 Awwwards jury actually rewards

From the juror review (hontran.dev) and the current Sites of the Day listing:

- **Art direction means a specific point of view.** Decorated templates lose.
- **Directed motion means choreography, not quantity.** Transitions must pace a narrative.
- **"Beauty at 60fps is the whole discipline."** Most contenders fail on mid-range hardware.
- Criticised: weak static frames hidden behind motion; pages that die under load; missing `prefers-reduced-motion` fallbacks.
- Trend context: immersive 3D took roughly 61% of Q1 2026 Sites of the Day, up from about 23% in 2024 — but a parallel editorial/typographic lane still wins without WebGL (By-Kin, sakazuki, The Pendragon Cycle). By-Kin won on *restraint*, weighted smooth scroll, magazine-style section navigation, grayscale, generous whitespace.

**Conclusion:** IdeaSpace cannot win the 3D lane — it is a records system used on ₹10,000 Android phones. It can win the editorial lane, where the discipline is typography, rhythm and restraint. That lane is also the one nobody in this category occupies.

### 1.3 Domain research that changes the design

**Open Badges 3.0 / W3C Verifiable Credentials.** A credential carries its own proof: issuer, criteria, evidence links, timestamp. Clicking a badge reveals exactly what it certifies and who issued it — the "Evidence Page" pattern. This is a published standard and it is the correct shape for IdeaSpace's core object. Do not invent a proprietary badge format.

**GitHub contribution graph criticism.** The consensus critique: it is "a frequency graph masquerading as a depiction of productivity"; commits are *inputs*, shipped work is the *output*; it is a textbook Goodhart's Law failure that became a hiring filter it was never designed to be. IdeaSpace's leaderboard is the same instrument. The design must not reproduce the mistake.

**Review-queue patterns.** Triage views show decision-critical context first with detail one interaction away; keyboard-first navigation (`j`/`k` move, `o` open, `a` approve, `c` comment); bulk approve only where items are low-risk; SLA targets and queue depth monitored in real time; four-eyes approval is a *UI architecture* — reviewer and approver need separate read paths.

**GoodUI (evidence-backed, metrics paywalled).** Single-column layouts read as clearer narrative (idea 1); fewer fields reduce abandonment (13); inline validation (33); progressive disclosure (43); smaller commitments before larger (44); upfront progress (42).

**Device baseline.** Budget Indian student phones (₹8,000–15,000) ship 4 GB RAM and eMMC storage; memory prices have risen roughly 4x since late 2025, so the floor is not improving. This is a hard constraint, not a nice-to-have.

---

## 2. Design directions considered

| | A — Campus Broadsheet | B — Swiss Records Office | C — Cinematic Dark | D — Terminal / Brutalist | **E — The Ledger (selected)** |
|---|---|---|---|---|---|
| Mood | student newspaper, opinionated | bureaucratic precision | premium, immersive | hacker, raw | archival, documentary, earned |
| Type | big serif headlines, dense columns | grotesque plus mono | tight sans, huge scale | mono only | editorial serif display, neutral sans, mono evidence voice |
| Colour | newsprint plus one red | grey plus signal red | black plus neon | black plus green | warm paper, ink, stamp colours |
| Motion | page-turn | none | parallax, reveals | cursor blink | state transitions only |
| Strength | memorable, cheap to run | credible, scales to data | "wow" | differentiated, cheap | credible **and** memorable; carries the product thesis |
| Risk | can read as unserious | can read as cold | indistinguishable from QWAD; fails the device baseline | alienates non-technical faculty | serif may read "old" to students |

**Direction C is rejected outright.** It is the competitor lane, it fails the device baseline, and the audit already identified 3D as zero-moat.

---

## 3. Selected direction: THE LEDGER

> A campus ledger is a book of record. Entries are dated, attributed, signed, and not erased. That is literally what this product is. The interface should look like the thing it is, not like every other student app.

Reference points and what is taken from each — **principles, not pixels**:

- **By-Kin** gives restraint, magazine section navigation, generous whitespace, a grayscale base with content supplying the colour.
- **Open Badges 3.0** gives the click-to-reveal evidence disclosure as the core interaction.
- **Review-queue practice** gives keyboard-first triage, progressive disclosure, visible SLA.
- **ProofLabAI** confirms the three-audience split is correct information architecture; its execution as generic light SaaS is not.
- **Deliberately not taken:** QWAD's dark canvas and purple, ProjectHub's emoji iconography, every competitor's centred-hero-plus-two-CTAs composition.

### 3.1 The three design principles

**1. No number without provenance.**
Every score, rank, count and percentage in the product is a link. Clicking it opens the Provenance Drawer: the exact events that produced it, each dated, attributed and sourced. A number that cannot open a drawer may not be displayed.
*This is the answer to the GitHub-graph critique, and it turns the audit's "why is this student ranked #7?" moment into a system-wide rule rather than one demo screen.*

**2. Ink is earned.**
Visual weight encodes evidence strength, not importance-by-assertion. Verified evidence renders at full ink (`--ink-900`, 1px solid rule, stamp mark). Pending evidence renders at `--ink-500` with a dashed rule. Claimed-but-unevidenced renders at `--ink-300` with no rule and no stamp. A screen full of unverified work *looks* faint. A project with real evidence *looks* heavy. The page becomes an honest instrument before anyone reads a word.

**3. Evidence is typeset, not iconified.**
A commit SHA, a deploy URL, a reviewer's name and a timestamp are set in mono and shown literally. No icon stands in for a fact. Icons are navigation aids only.

### 3.2 Anti-slop kill list (enforced)

Delete from `src/app/globals.css`: `.aurora-bg` and `@keyframes aurora-drift`, `.noise`, `.glass`, `.glass-strong`, `.glass-card`, `.card-glow`, `.glow-accent`, `.glow-green`, `.glow-ember`, `.gradient-accent-text`, `.gradient-ember-text`, `.gradient-green-text`, `.gradient-gold-text`, `.animate-gradient-x`, `.animate-text-shimmer`, `.animate-float`, `.animate-pulse-glow`, `.animate-spin-slow`, and the `.delay-75` through `.delay-800` ladder.

Banned going forward: purple/indigo as brand, glassmorphism, glow borders, blurred orbs, gradient text, floating animation, particles, WebGL, Three.js, shader backgrounds, fake charts, emoji as iconography, generic "AI" visual language.

`.dot-grid` survives at 3% opacity or less, on the public landing page only, as paper tooth.

---

## 4. Design tokens

Tailwind v4 `@theme` in `src/app/globals.css`. Light is the default; dark is warm, not blue-black, so it is not mistaken for a competitor.

```css
:root {
  /* Paper — warm archival, not white */
  --paper-0:   #FAF7F2;   /* canvas */
  --paper-1:   #F3EEE5;   /* raised: cards, rails */
  --paper-2:   #EAE3D6;   /* sunken: wells, code blocks */

  /* Ink */
  --ink-900:   #14161A;   /* verified / primary text */
  --ink-700:   #33383F;   /* secondary text */
  --ink-500:   #5E656F;   /* pending */
  --ink-300:   #8B919B;   /* unevidenced / disabled */
  --rule:      #DCD3C4;   /* hairlines, 1px */
  --rule-soft: #EAE3D6;

  /* Stamp — state only, never decoration */
  --stamp-verified: #0F6B4F;  /* 5.9:1 on paper-0 */
  --stamp-pending:  #8A5A00;  /* 5.3:1 */
  --stamp-rejected: #B3321F;  /* 5.5:1 */
  --stamp-archived: #5E656F;

  /* Type */
  --font-display: 'Instrument Serif', Georgia, serif;
  --font-body:    'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;

  /* Scale — 1.25 major third, 16px base */
  --t-display: 3.815rem/1.05;
  --t-h1:      3.052rem/1.1;
  --t-h2:      2.441rem/1.2;
  --t-h3:      1.563rem/1.3;
  --t-body:    1rem/1.6;
  --t-small:   0.875rem/1.5;
  --t-meta:    0.75rem/1.4;   /* mono, +0.04em tracking, uppercase */

  /* Space — 4px base */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px; --s-9: 96px;

  /* Radius — near-square. Paper does not have 24px corners. */
  --r-sm: 2px; --r-md: 4px; --r-lg: 6px; --r-full: 9999px; /* full: avatars only */

  /* Elevation — rules and tint, not shadow */
  --e-0: none;
  --e-1: 0 1px 0 var(--rule);
  --e-2: 0 1px 2px rgb(20 22 26 / 0.06), 0 0 0 1px var(--rule);
  --e-3: 0 8px 24px rgb(20 22 26 / 0.10), 0 0 0 1px var(--rule);

  /* Motion */
  --ease-out:   cubic-bezier(0.2, 0, 0, 1);
  --ease-stamp: cubic-bezier(0.34, 1.4, 0.64, 1);
  --d-micro: 120ms; --d-component: 200ms; --d-page: 280ms;

  /* Layout */
  --container:  1240px;
  --measure:    68ch;   /* max line length for prose */
  --rail-left:  260px;
  --rail-right: 320px;
}

:root[data-theme="dark"] {
  --paper-0: #16130F;  --paper-1: #1E1A15;  --paper-2: #272219;
  --ink-900: #F2EDE3;  --ink-700: #C9C2B5;  --ink-500: #9A9284;  --ink-300: #6C655A;
  --rule: #342E25;     --rule-soft: #272219;
  --stamp-verified: #4FBE92; --stamp-pending: #E0A63C;
  --stamp-rejected: #F07A64; --stamp-archived: #9A9284;
}
```

Breakpoints: `sm 480`, `md 768`, `lg 1024`, `xl 1280`, `2xl 1536`.
Z-index: `base 0`, `rail 10`, `sticky 20`, `drawer 30`, `modal 40`, `toast 50`, `commandbar 60`.

### 4.1 Token bug to fix first

`src/app/layout.tsx` loads Sora / IBM Plex Sans / JetBrains Mono via `next/font` and binds them to `--font-display` / `--font-body` / `--font-mono`. `src/app/globals.css` then re-declares the same three variables as `'Geist', 'Inter'`. Two declarations, same specificity, source-order dependent — the system has no single answer to "what font is this". v2 declares fonts in exactly one place: `next/font` in `layout.tsx`. `globals.css` never redeclares them.

---

## 5. Typography

- **Display — Instrument Serif, one weight.** Chosen because every competitor in this category uses a geometric or neo-grotesque sans. A serif at 48–96px is an instant, zero-cost identity signal, and one weight keeps the font budget small enough for the device baseline. Alternate if a weight range proves necessary: Fraunces variable, subset to two axes.
- **Body — IBM Plex Sans, 400/600.** Institutional, neutral, already installed. It is the voice of the system, not of the brand.
- **Evidence — JetBrains Mono, 400/500.** Mono means *this is a fact from a source*: SHAs, URLs, timestamps, reviewer handles, scores. Mono is never used for prose.

Rules: prose capped at `--measure` (68ch); display type uses `-0.02em` tracking; mono meta uses `+0.04em` uppercase; no font below 12px; `tabular-nums` everywhere a value can change.

Font budget: three families, five weights, latin subset, `display: swap`, self-hosted through `next/font`. No icon font — Lucide tree-shaken only.

---

## 6. Information architecture

Five destinations. The current app has eleven top-level routes, several of which are the same idea wearing different names.

```
IDEAS       discovery and posting             (merges /feed + /dashboard)
PROJECTS    build, team, milestones           (from /ideas/[id])
LEDGER      evidence and verification         (merges /wall + /archive)   <- new centre of gravity
PEOPLE      profiles, leaderboard             (merges /profile + /leaderboard)
CAMPUS      workshops, bounties               (merges /forge + /bounties)

ADMIN       review queue, analytics, roster   (role-gated, separate shell)
```

`/dashboard` and `/feed` are two implementations of one screen; `/ideas/new` and `/ideas/post` are two implementations of one form. Both pairs collapse.

**LEDGER becomes the primary navigation item**, not the fourth. The audit's conclusion was that the evidence ledger is the only defensible asset; navigation must say so.

---

## 7. Screen inventory

**Public** — Landing, For Institutions, Public project page, Public profile, 404 / 403 / 500 / offline
**Auth** — Sign in, Request access, Email sent, Domain rejected, Onboarding (3 steps)
**Core** — Ideas index, Idea detail, Post idea, Project workspace, Evidence submit, Ledger index, Evidence detail (Evidence Page), People index, Profile, Campus index, Workshop detail, Bounty detail
**Admin** — Review queue, Evidence review detail, Analytics, Roster, Audit log
**System** — loading / empty / error per screen

No new screens beyond these.

---

## 8. Signature components

### 8.1 Ledger Line — the atom

One row is one event. It replaces the decorative "Proof Rail". Desktop is a single line; mobile stacks to two.

```
2026-09-08  14:22   PR #184 merged      atlas-api      H. Varma    VERIFIED   >
2026-09-07  09:10   Deploy live         vercel.app     H. Varma    PENDING    >
2026-09-05  16:44   Milestone 03        —              team        VERIFIED   >
```

Mono timestamp, plain-language event, source (linked, literal), actor, stamp, disclosure chevron. Row ink weight follows principle 2. Rows are keyboard-navigable with `j`/`k`, and `Enter` opens the Evidence Page.

### 8.2 Provenance Stamp

The verification mark: a small letterpress-style mark, not a glowing badge. Three states — VERIFIED (`--stamp-verified`), PENDING (`--stamp-pending`), REJECTED (`--stamp-rejected`), each pairing a colour with a glyph and a text label. Clicking it opens the Evidence Page.

### 8.3 Evidence Page (Open Badges 3.0 shape)

What was claimed, who issued the verification, the criteria applied, the evidence artefacts (linked, with content hash and capture time), the decision, reviewer, rationale and date, and an appeal link. Nothing here is decorative; this screen is the product.

### 8.4 Provenance Drawer

Slides from the right on desktop, rises as a sheet on mobile. Opened by *any* number in the product. Header restates the number; body is a list of Ledger Lines summing to it; footer links to a full-page view. Closes on `Esc`, restores focus to the trigger.

### 8.5 Ink Meter

Replaces `HealthScoreRing`. A horizontal segmented bar, not a ring — rings imply completion, and this measures brief completeness. Four labelled segments matching the audit's decomposition: **Brief, Evidence, Momentum, Validation**. Each segment opens the drawer.

The label is **"Brief completeness"**, not "Health Score". The current algorithm scores form-field completeness, so calling it health is a false claim rendered in the UI.

### 8.6 Review Bench (admin)

Two panes, keyboard-first. Left: queue with SLA age colour-coded by `--stamp-*`, filters by type / age / department, queue-depth count in the header. Right: evidence with decision-critical context first and the full record one keypress away. `j`/`k` move, `o` open, `a` approve, `r` reject, `c` comment, `?` shows shortcuts. Bulk approve is available **only** for machine-verified, low-risk items and always states how many rows it will affect.

### 8.7 Standard components

Button (primary / secondary / ghost / destructive), Input, Select, Textarea, Checkbox, Radio, Tabs, Card, Table, Dialog, Drawer, Sheet, Toast, Tooltip, Avatar, Badge, Skeleton, EmptyState, ErrorState, Pagination, CommandBar, FilterBar, Stat (always drawer-linked).

Retired: `HealthScoreRing`, `PointsCounter` (spring-animated numbers imply precision the data lacks), `evidence-wall`, `comparison-table`, `card-spotlight`, `card-glow`.

---

## 9. Motion system

Motion exists to show state change. Nothing else.

| Level | Duration | Applies to |
|---|---|---|
| 1 — micro | 120ms `--ease-out` | hover, focus, press, checkbox, row highlight |
| 2 — component | 200ms `--ease-out` | drawer, sheet, tab, inline edit, toast |
| 3 — page | 280ms `--ease-out` | route change: 8px rise plus fade, never slide-across |
| 4 — experience | 420ms `--ease-stamp` | **two moments only** |

The two Level-4 moments:

1. **The stamp lands.** On verification, the Provenance Stamp presses onto the row with a slight overshoot and the row's ink darkens from `--ink-500` to `--ink-900`. This is the product's emotional payload: work becoming record.
2. **Project revival.** An archived project's ledger folds into the new team's workspace, carrying its history visibly.

Scroll is native. No smooth-scroll hijack, no parallax, no scroll-triggered reveals inside the app. The landing page may use one weighted scroll sequence for the proof pipeline, and only there.

`prefers-reduced-motion: reduce` drops all transforms to opacity-only at 100ms and makes Level 4 an instant state swap. Per the jury critique, **the static frame must be strong enough that the product loses nothing with motion off** — that is the acceptance test, run by disabling motion and reviewing every screen.

---

## 10. Responsive strategy

Mobile is not desktop-minus. Compositions are authored per breakpoint.

**Desktop, 1280 and up** — three rails: filters (260px), content, activity ledger (320px). Sticky section navigation.

**Tablet, 768 to 1279** — two rails; the activity ledger becomes a bottom-anchored collapsible drawer; filters become a sticky bar.

**Mobile, below 768** — single column, `--measure` full-bleed minus 16px gutters.

- Bottom navigation, five items, 56px tall, labels always visible. Icon-only bottom bars fail recognition for non-technical faculty.
- Filters become a sticky top bar plus a full-screen sheet.
- Ledger Lines stack to two lines: event and stamp on line 1, mono timestamp and source on line 2.
- The Provenance Drawer becomes a bottom sheet at 85vh with a drag handle **and** a visible close button.
- The Review Bench becomes a stacked queue with explicit Approve and Reject buttons. Swipe is an accelerator, never the only path.
- Tables never scroll horizontally; they reflow to definition lists.

**Performance budget** (baseline: 4 GB RAM, eMMC, 4G): 160 KB gzipped JS or less on the Ideas route, LCP under 2.5s, INP under 200ms, CLS under 0.1, 60fps scroll on a 4 GB Android. Framer Motion is imported per component, never globally. No route may ship a WebGL context.

---

## 11. States

Every screen specifies twelve. Non-negotiable, because a polished mockup without these states is not complete UX.

Default, Loading (skeletons matching final geometry, never spinners), Empty, Error, Success, Disabled, Partial data, Slow network (past 3s, "Still loading — this campus has a lot of records"), Permission denied (names *which* role is required and who to ask), First-run, Returning, Mobile.

**Empty states carry a first action, not an illustration.** Ledger empty: "No evidence yet. Connect a repository or submit a link — both take under a minute," with both buttons present.

**Error states name the failure and the recovery.** Not "Something went wrong" but "Could not reach GitHub. Your evidence is saved as a draft. Retry."

---

## 12. Accessibility

- Contrast: body text at 7:1 or better (AAA) on paper; every `--stamp-*` value at 5.3:1 or better (AA), measured and listed in section 4.
- **State is never colour alone.** Every stamp pairs colour with a glyph and a text label.
- Focus: 2px `--ink-900` ring at 2px offset, visible on every surface including stamp colours. Never `outline: none`.
- Touch targets 44x44px minimum; bottom-nav items 56px.
- Full keyboard paths for the review queue, ledger navigation, command bar, drawer and all forms. Shortcuts discoverable with `?`.
- Semantic HTML: `<time datetime>` for every timestamp, `<table>` for tabular data, `<button>` for actions, `<a>` for navigation. The Ledger is a real list.
- Forms: visible persistent labels, never placeholder-as-label; inline validation on blur; errors as icon plus text plus `aria-describedby`; `aria-live="polite"` for async results.
- `prefers-reduced-motion` is honoured at the token layer so no component can opt out.
- Screen-reader text on every stamp: "Verified by Dr. A. Rao on 8 September 2026."

---

## 13. Design risks

| Risk | Severity | Mitigation |
|---|---|---|
| Serif display reads "old" to 19-year-olds | High | Test with 10 students before committing; serif is confined to display sizes, all UI chrome stays sans |
| Light paper reads "less technical" than competitors' dark | Medium | Ship dark mode at launch; the warm dark still avoids the competitor lane |
| "Ink is earned" makes early campuses look empty and dead | **High** | Empty ledgers get an explicit first-run treatment; faintness is framed as "not verified yet", never as failure |
| Full rebuild across roughly 24 components | High | Token-first migration: swap `globals.css`, then components in dependency order; both themes ship behind one token file |
| Rejecting WebGL costs Awwwards "wow" | Low | The editorial lane demonstrably still wins, and the device baseline makes 3D indefensible regardless |
| Provenance Drawer everywhere is a large surface to build | Medium | One component, one data contract; every stat consumes the same endpoint |

---

## 14. Self-assessment against the jury's three criteria

**Art direction — a specific point of view?** Yes. The product is a book of record, and paper / ink / stamp is that thesis rendered literally. It is the only direction in this category not derived from dark-mode dev-tool aesthetics.

**Directed motion — choreography, not effects?** Yes. Four levels, two Level-4 moments, both carrying narrative meaning: work becoming record, and history transferring to a new team. Everything else is state feedback under 300ms.

**Performance — 60fps on mid-range?** This is the direction's strongest claim. No WebGL, no shaders, no blur layers, no infinite background animation, three font families. The current build's `.aurora-bg` alone runs a 20s infinite transform on a fixed full-viewport layer; removing it is a measurable win on a 4 GB device.

**Honest weakness:** the static frame does nearly all the work. If the typography and rhythm are executed at anything less than excellent, there is no motion layer to hide behind. That is the correct pressure for this product and the wrong pressure for a weak type system — so typography is the first thing to get right, not the last.

---

## 15. Build order

1. Fix the duplicate font-token declaration; delete the kill list from `globals.css`.
2. Land the v2 token block, both themes.
3. Typography scale, `--measure`, tabular numerals.
4. Primitives: Button, Input, Card, Badge/Stamp, Table, Skeleton, EmptyState, ErrorState.
5. **Ledger Line, Provenance Stamp, Evidence Page, Provenance Drawer** — the differentiator, built before any feed polish.
6. Ink Meter; rename Health Score to Brief completeness in UI and code.
7. Review Bench with keyboard paths and SLA.
8. Collapse `/feed` plus `/dashboard`, and `/ideas/new` plus `/ideas/post`.
9. Responsive compositions per breakpoint; bottom navigation.
10. Accessibility pass: contrast audit, keyboard walkthrough, reduced-motion review of every screen.
11. Landing page last. It is marketing; the ledger is the product.
