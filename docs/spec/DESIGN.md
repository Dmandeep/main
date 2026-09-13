# IdeaSpace DESIGN.md

## 1. Visual Theme and Atmosphere
Campus-native, builder-first, evidence-forward. Feels credible and fast, with warm neutral surfaces and sharp tech accents. No generic AI glow. The UI should feel like a workshop that ships, not a showcase that performs.

Signature element: a "Proof Rail" that shows real activity (commits, demos, workshop RSVP, postmortems) as a thin horizontal strip on key pages.

## 2. Color Palette and Roles
Warm neutrals for canvas, deep ink for text, and teal/ember for actions and status.

CSS variables (hex):
--ink-900: #0B0F14
--ink-700: #1C2430
--ink-500: #3B485A
--ink-300: #6C7A8F
--ink-100: #C9D1DC
--canvas-0: #F7F3EC
--canvas-50: #EFE8DE

--teal-500: #1FB7A6
--teal-700: #128A7B
--ember-500: #FF6B4A
--ember-700: #D95236
--lime-400: #C7E85B

--success: #2EA86A
--warning: #F2B24B
--danger: #E5484D
--info: #3D8BFF

Usage rules:
- Primary actions use teal-500 on canvas-0.
- Destructive actions use danger with clear confirmation.
- Status chips use ink-900 text on tinted backgrounds.

## 3. Typography Rules
Use expressive but clean fonts. Avoid default system stacks.

Fonts:
- Display: Sora
- Body: IBM Plex Sans
- Mono: JetBrains Mono

Type scale (px):
- display-1: 48/56
- display-2: 36/44
- h1: 28/36
- h2: 22/30
- h3: 18/26
- body: 16/24
- small: 14/20
- micro: 12/16

## 4. Component Stylings
Buttons: crisp edges (radius 10), strong hover shift, clear focus ring.
Cards: warm canvas, thin ink-100 border, light shadow. Use consistent card density.
Inputs: soft inset, clear label, strong error state with icon and message.
Tabs: compact pill with ink-700 text, active tab uses teal underline.
Badges: small caps for status (e.g., VERIFIED, IN REVIEW).

Special components:
- Proof Rail: thin, scrollable activity strip with icons and timestamps.
- Idea Health: compact score meter with 3 improvement prompts.
- Upvote Strip: vote count, trend arrow, last activity.

## 5. Layout Principles
- 12 column grid, 24px gutter, max width 1200px.
- Base spacing 4px; scale 4, 8, 12, 16, 24, 32, 48, 64.
- Use content rails: left for filters, center for cards, right for activity.

## 6. Depth and Elevation
Subtle shadows only. Use elevation to separate cards, not to decorate.
Avoid heavy blur or glassmorphism.

## 7. Dos and Donts
Do:
- Show evidence and status on every idea card.
- Use warm neutrals with teal/ember accents.
- Provide visible error and empty states.
- Keep forms fast and guided.

Dont:
- No purple-on-white defaults.
- No vague "AI" gradients.
- No hidden actions without labels.
- No empty cards without context.

## 8. Responsive Behavior
- Mobile first for feed and idea detail.
- Sticky filter bar on mobile, collapsible rail on desktop.
- Minimum 44px touch targets.
- Keep Proof Rail visible on key screens.

## 9. Agent Prompt Guide
Build screens that show real progress and evidence. Use the Proof Rail and health scores to make activity visible. Keep layouts dense but readable. Never add UI elements without a destination. Avoid generic AI aesthetics.