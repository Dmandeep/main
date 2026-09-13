# IdeaSpace Full Product Design (2026-05-03)

## Product summary
IdeaSpace (aka IdeaSync in code) is a campus-native intelligence platform where students post ideas, recruit collaborators, run workshops, and build a verifiable proof of work trail. The product should feel credible and fast, not generic.

## Vision
Make the best student ideas discoverable, buildable, and finishable with visible proof of impact.

## Design principles
- No slop: every action must have a real destination and visible result.
- Evidence first: show proof of work, not promises.
- Campus-first: reflect real academic and project rhythms.
- Speed and clarity: optimize for quick scanning and decisive actions.
- Trust by default: transparent ownership, clear permissions, safe moderation.

## Primary users and jobs
- Student builders: find teammates, post ideas, track progress, earn reputation.
- Student leaders: run workshops, validate demand, coordinate projects.
- Admins and moderators: verify, curate, resolve reports, run leaderboards.

## Core journeys
1) Onboarding
- Join with campus email
- Set profile, skills, interests
- Select goals: build, learn, mentor

2) Post an idea
- Title, problem, solution, needed skills, tags
- Health score and improvement prompts
- Publish and track interest

3) Join a build or forge event
- Discover ideas and workshops
- Request to join or RSVP
- Gain points for validated actions

4) Proof wall and archive
- Submit proof of completion
- Archive failures with learnings
- Earn reputation for honest postmortems

5) Leaderboard and profile
- Transparent point rules
- Profile shows work, not vanity

6) Admin and moderation
- Review reports, role management
- Feature flags for experiments

## Information architecture
App areas inferred from existing routes:
- Landing
- Auth
- Feed
- Ideas
- Profile
- Leaderboard
- Forge (workshops)
- Archive (postmortems)
- Wall (proof)
- Notifications
- Admin

## Feature scope by milestone
M1 - Firebase core
- Firestore schema and security rules
- Auth providers (email, GitHub)
- Firebase emulator setup
- Migration plan from Prisma
- Cloud Functions for voting and leaderboards

M2 - UI rebuild
- Design system tokens and components
- Redesigned core screens
- Accessibility audit and fixes
- Motion and microinteractions

M3 - Scale and launch
- Performance monitoring
- Feature flags and experiments
- CI for rules tests and deploys
- Analytics, alerts, and dashboards

## Data domains (high level)
- Users and profiles
- Ideas and tags
- Events and workshops
- Votes and reputation
- Notifications
- Proof and archive entries

## AI and automation features
- Idea health score (clear criteria)
- Auto summaries for ideas and postmortems
- Onboarding prompts and guided creation

## Content and voice
- Direct, candid, builder-centric
- Avoid hype, avoid vague claims
- Use short labels and clear actions

## Non-functional requirements
- LCP under 2.5s on mobile
- 100 percent keyboard navigable primary flows
- WCAG AA contrast minimum
- Error states visible and specific

## Risks and assumptions
- Data migration from Prisma to Firestore must be tested early
- Reputation and points need abuse prevention
- Admin moderation requires clear policy and tooling

## Open decisions
- Final naming: IdeaSpace vs IdeaSync
- Decide the default moderation model
- Choose motion system: GSAP for hero, Framer Motion for UI
