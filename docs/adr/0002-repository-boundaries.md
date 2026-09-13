# ADR 0002 — One repository, one product

- **Status:** Accepted
- **Date:** 2026-09-11

## Context

Before this change the repository tracked **785 files, of which only 116 were the IdeaSpace
application.** The remainder:

| Path | Files | What it was |
|---|---:|---|
| `assesment-main/` | 88 | "Secure Assessment Gateway" — an unrelated Next.js + Firebase exam product |
| `superpowers-main/` | 147 | vendored third-party methodology repo |
| `gitreverse-main/` | 50 | vendored third-party repo |
| `project/agency-agents-main/` | 239 | vendored third-party repo |
| `project/vibe-coding-prompt-template-main/` | 43 | vendored third-party repo |
| `project/gemini-superpowers-antigravity-main/` | 31 | vendored third-party repo |
| `project/ZeroSlop-main/` | 27 | vendored third-party repo |
| `project/firecrawl-py-main/` | 7 | vendored third-party repo |
| `project/awesome-claude-design-main/` | 2 | vendored third-party repo |

`project/` also held a second, stale copy of the application scaffold — its own
`package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`,
`postcss.config.mjs`, `eslint.config.mjs`, `vercel.json`, `.gitignore`, default Next.js
`public/` SVGs, and a **committed 90 KB SQLite database** (`prisma/dev.db`).

Three README files existed; two were byte-identical and the third was a truncated draft whose
Quick Start told developers to `git clone .../ZeroSlop.git && cd ZeroSlop`.

## Decision

This repository contains the IdeaSpace application and its documentation. Nothing else.

- Unrelated products are split out. `assesment-main/` was moved to `../_split/` and untracked.
- Reference material is read, not vendored. The third-party repos were moved to
  `../_vendor-reference/` and untracked. Cite them by URL in docs.
- One README, at the repository root.
- No binary databases in version control; `*.db`, `*.sqlite`, `*.sqlite3` are gitignored.
- Documentation layout:
  - `docs/spec/` — product and design specification
  - `docs/ux/` — flows, journeys, JTBD, screen specs
  - `docs/adr/` — architecture decision records
  - `docs/legacy/` — superseded material, kept for provenance only
  - `AGENTS.md`, `CLAUDE.md`, `gemini.md` at root, where agent tooling reads them

## Consequences

- Tracked files drop from 785 to ~145. Clone size and review surface shrink accordingly.
- Anything under `docs/legacy/` is historical. It does not describe current behaviour and must
  not be cited as a requirement.
- The moved directories are outside the repository, not deleted. They remain in git history.
