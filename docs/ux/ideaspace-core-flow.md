# User Flow: Onboarding to First Idea

## Entry point
- User lands on IdeaSpace from a club invite or campus email

## Flow steps
1) Landing page
   - Proof-first hero and activity snapshots
   - Primary action: "Join with campus email"

2) Auth
   - Email or GitHub login
   - Optional: "I am here to build" vs "I am here to mentor"

3) Profile setup
   - Skills, interests, availability
   - Small preview of profile card

4) First action chooser
   - "Post an idea" or "Join a project"

5) Post an idea
   - Short form: problem, solution, needed skills, tags
   - Live health score and suggestions
   - Publish and show idea card in feed

6) Success state
   - Confirmation with next steps
   - Invite link for teammates

## Exit points
- Success: idea posted and visible on feed
- Partial: saved draft and reminder
- Blocked: invalid campus email or missing required field

## Design principles for this flow
1) Proof-first: show activity and proof early
2) Clarity: each step explains what happens next
3) Momentum: forms short, immediate feedback
4) Trust: show ownership and visibility on publish

## Accessibility requirements
Keyboard navigation:
- All steps reachable via Tab
- Clear focus indicator on buttons and inputs
- Enter and Space trigger actions

Screen reader support:
- Inputs have visible labels, not placeholder-only
- Error messages announced with ARIA live region
- Step change announces "Step X of Y"

Visual accessibility:
- Text contrast at least 4.5:1
- Buttons at least 44px height
- Errors use icon plus text, not color only