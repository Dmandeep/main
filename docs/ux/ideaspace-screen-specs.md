# IdeaSpace Screen Specs (Assumption-Based)

Assumptions (pending confirmation):
- Primary user: student builder, intermediate skill
- Devices: mobile for discovery, desktop for creating and proof
- Accessibility: WCAG AA, keyboard-first for core flows

## Screen 1: Landing
Purpose: proof-first credibility and fast conversion to join.

Layout
- Hero: value prop + proof rail under the fold.
- Proof Pipeline: 3 steps (Post -> Build -> Verify) with status chips.
- Evidence Wall: recent verified builds with timestamps.
- Forge Demand: upcoming workshops with RSVP count.
- Archive Credibility: postmortem cards with lessons count.
- Comparison: IdeaSpace vs WhatsApp/Forms/Discord.
- CTA: join with campus email.

Key components
- Proof Rail (horizontal activity strip)
- Stat Strip (projects shipped, workshops hosted, proof items)
- Evidence Card (project name, owner, proof type, time)
- Comparison Table

Copy notes
- No hype, no buzzwords. Use short verbs and visible outcomes.
- Replace generic stats with real counts once data exists.

Motion
- Hero: subtle fade + staggered proof rail reveal.
- Proof Pipeline: step hover reveals detail.

## Screen 2: Feed
Purpose: fast discovery and trust via activity signal.

Layout
- Header with action: Deploy Idea
- Command Center: search + filters + sort
- Feed grid with Proof Rail above the grid

Card anatomy
- Domain badge, status chip (DISCOVERY / BUILDING / SHIPPED)
- Title + 2-line description
- Health score + 2 improvement hints
- Proof summary: last update, last proof type
- Owner + tier, upvotes, applicants

States
- Loading: skeleton cards
- Empty: prompt to deploy
- Filtered: show active filters as removable chips

## Screen 3: Idea Detail
Purpose: deep proof, clear apply flow, visible ownership.

Layout
- Title, domain, status, activity meta
- Overview section with structured blocks
- Proof Timeline (commit, demo, doc, workshop)
- GitHub block if linked
- Sidebar: apply, builder card, health, skills

Proof Timeline
- Entry types: commit, demo, doc, workshop, archive
- Each entry: timestamp, summary, link, evidence label

Apply flow
- Short prompt, 2 questions
- Clear submission state and confirmation

## Screen 4: Create Idea
Purpose: guided form with live health improvement.

Layout
- Left: form
- Right: live preview + health meter

Form sections
- Title
- Problem and solution (separate fields)
- Domain
- Skills
- Optional repo

Health meter
- Score + 3 short improvement prompts
- Clearly shows which input influences score

Errors
- Inline, precise, with recovery tips

## Accessibility requirements
- All form labels visible, not placeholder-only
- Error messaging announced via aria-live
- Focus outline visible on all interactive elements
- Minimum 44px touch target