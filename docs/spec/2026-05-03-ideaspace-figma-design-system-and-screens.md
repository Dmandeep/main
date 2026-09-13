# IdeaSpace Figma Design System and Screens (2026-05-03)

## Goals
- Build a distinctive, campus-native UI system
- Avoid generic AI aesthetics
- Make UI fast, legible, and high signal

## Figma file structure
- 00 - Foundations
- 01 - Components
- 02 - Patterns
- 03 - Templates
- 04 - Screens
- 05 - Prototypes

## Foundations

### Color tokens
Use warm neutrals with a sharp tech accent. No purple on white.

Neutrals
- ink-900: #0B0F14
- ink-700: #1C2430
- ink-500: #3B485A
- ink-300: #6C7A8F
- ink-100: #C9D1DC
- canvas-0: #F7F3EC
- canvas-50: #EFE8DE

Accents
- teal-500: #1FB7A6
- teal-700: #128A7B
- ember-500: #FF6B4A
- ember-700: #D95236
- lime-400: #C7E85B

Semantic
- success: #2EA86A
- warning: #F2B24B
- danger: #E5484D
- info: #3D8BFF

### Typography
Avoid default stacks. Suggested Google Fonts:
- Display: Sora
- Body: IBM Plex Sans
- Mono: JetBrains Mono

Type scale (px)
- display-1: 48/56
- display-2: 36/44
- h1: 28/36
- h2: 22/30
- h3: 18/26
- body: 16/24
- small: 14/20
- micro: 12/16

### Spacing and layout
- Base spacing: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64
- Grid: 12 columns, 24px gutter, 96px max padding
- Max content width: 1200px

### Radius and elevation
- Radius: 6, 10, 16
- Shadows: subtle, layered, no heavy blur

### Motion
- Fast: 150ms
- Base: 250ms
- Slow: 400ms
- Easing: cubic-bezier(0.22, 0.61, 0.36, 1)

### Iconography and imagery
- Simple line icons with consistent stroke weight
- Photo usage: real campus or workshop moments
- Avoid stocky AI-sci-fi visuals

## Components (core)
- Buttons: primary, secondary, ghost, danger
- Inputs: text, textarea, select, search
- Badges and tags
- Tabs and segmented controls
- Cards: idea, profile, event, archive
- Modals and drawers
- Tables and leaderboard rows
- Toasts and alerts
- Avatars and stacks
- Pagination and filters
- Tooltips and popovers
- Empty states and loading

## Patterns
- Idea health score widget
- Upvote and reputation strip
- Workshop RSVP module
- Proof wall card
- Archive postmortem block
- Admin moderation table

## Screens
1) Landing
- Hero with proof-first value props
- Quick stats and proof wall preview
- CTA to join with campus email

2) Auth and onboarding
- Email and GitHub login
- Profile setup with skills and interests
- First idea prompt or browse feed

3) Feed
- Filter rail and search
- Cards for ideas, workshops, archive

4) Idea detail
- Problem, solution, skills needed
- Contributors and status
- Activity, comments, and updates

5) Create idea
- Guided form with live health score
- Preview card and publish checklist

6) Forge (workshops)
- Upcoming events and demand signals
- RSVP flow and host profile

7) Archive
- Postmortem layout with lessons
- Fork and adopt CTA

8) Proof wall
- Verified builds, GitHub evidence
- Filters for category and cohort

9) Leaderboard
- Ranks, badges, and trend chips

10) Profile
- Bio, stats, activity feed, contributions

11) Notifications
- Compact list with actions

12) Admin
- Role management
- Reports and content actions

## Prototypes
- Onboarding to first idea
- Browse feed to join project
- Postmortem to fork project
