# IDEASPACE — ULTRA MASTER BUILD PROMPT (MongoDB Atlas Edition)
> Version: 2.0 | Date: 2026-05-04 | Stack: Next.js 15 + MongoDB Atlas + NextAuth.js v5

---

## 0. PURPOSE OF THIS DOCUMENT

This is the single source of truth for building IdeaSpace from scratch on MongoDB Atlas.
Every AI agent, developer, or code generator working on this codebase MUST read this entire
document before writing a single line of code.

This document covers:
- Product vision and principles
- Full tech stack with justifications
- Behavior contract (anti-shortcuts)
- Complete folder and file structure
- MongoDB Atlas schema (all Mongoose models)
- NextAuth.js v5 auth setup
- Design system tokens (colors, typography, spacing, motion)
- Every screen spec with layout, components, and data
- Every API route with method, input, and output
- Phased milestone plan

---

## 1. PRODUCT OVERVIEW

**Name:** IdeaSpace (internal code: ideaspace)
**Tagline:** Build in public. Prove your work. Earn your rank.

IdeaSpace is a campus-native innovation platform for Lendi Institute of Engineering
and Technology. Students post ideas, recruit collaborators, run workshops (Forge), build
a verifiable proof-of-work trail, and earn reputation points on a transparent leaderboard.

The product must feel like a professional SaaS tool — not a student project, not a generic
Notion clone, not a glorified Google Form. Benchmark visual quality: Linear, Vercel, Raycast.

### Core user types
| Role | Primary job |
|---|---|
| student | Post ideas, join builds, earn points, attend workshops |
| faculty | Run workshops, verify milestones, review queue |
| admin | Moderation, role management, analytics |
| mentor | Guide projects, verify proof entries |
| judge | Score bounties, review submissions |

### Core product areas
- Feed — idea discovery and filtering
- Idea Detail — full idea page with proof timeline
- Create Idea — guided form with live health score
- Forge — workshops, RSVPs, demand signals
- Proof Wall — verified build evidence
- Archive — postmortems and forks
- Leaderboard — transparent point rankings
- Profile — work history, contributions, rank
- Bounties — task-based reward challenges
- Admin — moderation, roles, content actions
- Landing — proof-first public page

---

## 2. TECH STACK

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components, server actions |
| Language | TypeScript 5.x | Strict mode ON, no `any` |
| Database | MongoDB Atlas (M0 free tier to start) | Cloud-hosted |
| ODM | Mongoose 8.x | Schema validation, virtuals, indexes |
| Auth | NextAuth.js v5 (beta) | Email magic link + GitHub OAuth |
| Styling | Tailwind CSS v4 | Custom design tokens |
| Animation | Framer Motion + GSAP | Motion for UI, GSAP for hero/landing |
| Data fetching | TanStack Query v5 | Client-side cache and mutations |
| Forms | React Hook Form + Zod | Validation on client and server |
| Icons | Lucide React | Consistent stroke weight |
| Fonts | Sora (display) + IBM Plex Sans (body) + JetBrains Mono | Google Fonts |
| File uploads | Cloudinary (free tier) | Profile photos, proof evidence |
| Testing | Vitest (unit) + Playwright (e2e) | Required |
| Linting | ESLint + Prettier | Enforced |
| Env | .env.local | Never commit secrets |

### Required packages (install all at project init)
```bash
npm install next@15 react@19 react-dom@19 typescript
npm install mongoose next-auth@beta @auth/mongodb-adapter
npm install tailwindcss@4 @tailwindcss/forms
npm install framer-motion gsap
npm install @tanstack/react-query react-hook-form zod @hookform/resolvers
npm install lucide-react clsx tailwind-merge
npm install cloudinary next-cloudinary
npm install --save-dev vitest @vitejs/plugin-react playwright
npm install --save-dev eslint prettier eslint-config-next
```

---

## 3. BEHAVIOR CONTRACT (ANTI-SHORTCUTS)

**Every AI agent and developer must follow these rules. No exceptions.**

### 3.1 Never do
- ❌ Use `any` type in TypeScript
- ❌ Leave TODO comments or placeholder text in delivered code
- ❌ Use `console.log` in production code (use a logger utility)
- ❌ Hardcode MongoDB connection strings or secrets
- ❌ Skip error handling in API routes (every route must handle errors)
- ❌ Skip loading states (every async UI must have a skeleton or spinner)
- ❌ Use inline styles (Tailwind classes only)
- ❌ Use `<form>` HTML elements in React components (use React Hook Form)
- ❌ Skip accessibility attributes (every interactive element needs aria labels)
- ❌ Create a page without a corresponding API route spec in this document
- ❌ Use `useEffect` for data fetching (use TanStack Query)
- ❌ Use `purple` or generic gradients in the UI
- ❌ Use Inter or Roboto fonts
- ❌ Deploy with mock data or fake API responses

### 3.2 Always do
- ✅ Validate all API inputs with Zod schemas
- ✅ Use server components for data fetching where possible
- ✅ Protect every route with the role middleware
- ✅ Return proper HTTP status codes from all API routes
- ✅ Use the design tokens defined in Section 6 — no custom hex values
- ✅ Use skeleton loaders that match the real component shape
- ✅ Write a unit test for every utility function
- ✅ Write an e2e test for every primary user journey
- ✅ Handle empty states with an illustration and clear CTA
- ✅ Log all database errors to a server-side logger

### 3.3 Code quality gates
Before marking any task complete, the following must pass:
```bash
npm run lint          # ESLint + Prettier
npm run test:unit     # Vitest
npm run test:e2e      # Playwright
npm run build         # Next.js production build, zero errors
```

---

## 4. FOLDER AND FILE STRUCTURE

```
ideaspace/
├── .env.local                        # secrets — never commit
├── .env.example                      # committed template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # root layout with fonts + providers
│   │   ├── page.tsx                  # landing page (public)
│   │   ├── globals.css               # design tokens + Tailwind base
│   │   │
│   │   ├── auth/
│   │   │   ├── login/page.tsx        # sign in page
│   │   │   ├── error/page.tsx        # auth error page
│   │   │   └── verify/page.tsx       # magic link verify page
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx              # post-auth profile setup
│   │   │
│   │   └── (app)/                    # protected app shell
│   │       ├── layout.tsx            # app shell with sidebar + header
│   │       ├── feed/page.tsx
│   │       ├── ideas/
│   │       │   ├── page.tsx          # idea list (redirects to feed)
│   │       │   ├── new/page.tsx      # create idea
│   │       │   └── [id]/
│   │       │       ├── page.tsx      # idea detail
│   │       │       └── edit/page.tsx
│   │       ├── forge/
│   │       │   ├── page.tsx          # workshops list
│   │       │   └── [id]/page.tsx    # workshop detail + RSVP
│   │       ├── wall/page.tsx         # proof wall
│   │       ├── archive/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── leaderboard/page.tsx
│   │       ├── bounties/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── profile/
│   │       │   └── [username]/page.tsx
│   │       ├── notifications/page.tsx
│   │       └── admin/
│   │           ├── page.tsx          # admin dashboard
│   │           ├── users/page.tsx
│   │           ├── reports/page.tsx
│   │           └── review/page.tsx   # review queue
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── AppShell.tsx
│   │   │
│   │   ├── landing/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Hero.tsx
│   │   │   ├── ProofPipeline.tsx
│   │   │   ├── EvidenceWall.tsx
│   │   │   ├── ComparisonTable.tsx
│   │   │   ├── OutcomeStats.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── ideas/
│   │   │   ├── IdeaCard.tsx
│   │   │   ├── IdeaStatusPill.tsx
│   │   │   ├── HealthScoreWidget.tsx
│   │   │   ├── IdeaForm.tsx
│   │   │   ├── ProofTimeline.tsx
│   │   │   └── ContributorStack.tsx
│   │   │
│   │   ├── forge/
│   │   │   ├── WorkshopCard.tsx
│   │   │   └── RsvpModule.tsx
│   │   │
│   │   ├── proof/
│   │   │   ├── ProofCard.tsx
│   │   │   ├── ProofRail.tsx
│   │   │   └── ProofSubmitModal.tsx
│   │   │
│   │   ├── archive/
│   │   │   ├── ArchiveCard.tsx
│   │   │   └── PostmortemBlock.tsx
│   │   │
│   │   ├── leaderboard/
│   │   │   ├── LeaderboardRow.tsx
│   │   │   └── RankBadge.tsx
│   │   │
│   │   ├── bounties/
│   │   │   └── BountyCard.tsx
│   │   │
│   │   ├── profile/
│   │   │   ├── ProfileHeader.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   └── SkillBadgeList.tsx
│   │   │
│   │   ├── admin/
│   │   │   ├── ReviewQueueTable.tsx
│   │   │   ├── UserTable.tsx
│   │   │   └── ReportCard.tsx
│   │   │
│   │   └── ui/                       # base design system components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── Drawer.tsx
│   │       ├── Avatar.tsx
│   │       ├── Skeleton.tsx
│   │       ├── Toast.tsx
│   │       ├── Tabs.tsx
│   │       ├── EmptyState.tsx
│   │       ├── FilterRail.tsx
│   │       └── KpiStrip.tsx
│   │
│   ├── lib/
│   │   ├── db.ts                     # MongoDB Atlas connection singleton
│   │   ├── auth.ts                   # NextAuth.js v5 config
│   │   ├── product-config.ts         # tracks, tiers, constants
│   │   ├── score-config.ts           # point values, daily caps
│   │   ├── health-score.ts           # idea health score algorithm
│   │   ├── logger.ts                 # server-side logger utility
│   │   ├── cloudinary.ts             # upload helpers
│   │   └── utils.ts                  # clsx, date helpers, slugify
│   │
│   ├── models/                       # Mongoose schemas
│   │   ├── User.ts
│   │   ├── Idea.ts
│   │   ├── Collaborator.ts
│   │   ├── Bounty.ts
│   │   ├── Workshop.ts
│   │   ├── ProofEntry.ts
│   │   ├── Archive.ts
│   │   ├── Vote.ts
│   │   ├── Notification.ts
│   │   ├── ReviewQueue.ts
│   │   └── Leaderboard.ts
│   │
│   ├── services/                     # business logic, no DB calls in components
│   │   ├── IdeaService.ts
│   │   ├── UserService.ts
│   │   ├── ProofService.ts
│   │   ├── BountyService.ts
│   │   ├── WorkshopService.ts
│   │   ├── LeaderboardService.ts
│   │   ├── NotificationService.ts
│   │   └── ReviewService.ts
│   │
│   ├── hooks/
│   │   ├── useIdeas.ts
│   │   ├── useProfile.ts
│   │   ├── useLeaderboard.ts
│   │   └── useNotifications.ts
│   │
│   ├── types/
│   │   ├── ideaspace.ts              # shared TypeScript types
│   │   └── next-auth.d.ts            # NextAuth session type augmentation
│   │
│   └── middleware.ts                 # route protection by role
│
├── public/
│   ├── logo.svg
│   └── og-image.png
│
└── tests/
    ├── unit/
    │   ├── auth.spec.ts
    │   ├── scoring.spec.ts
    │   ├── health-score.spec.ts
    │   └── tracks.spec.ts
    └── e2e/
        ├── landing.spec.ts
        ├── onboarding.spec.ts
        ├── idea-flow.spec.ts
        ├── proof-flow.spec.ts
        └── admin.spec.ts
```

---

## 5. MONGODB ATLAS SETUP

### 5.1 Connection singleton — `src/lib/db.ts`
```typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in environment variables.");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongoose: MongooseCache;
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null };
global.__mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: "ideaspace",
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
```

### 5.2 Environment variables — `.env.example`
```bash
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/ideaspace

# NextAuth
AUTH_SECRET=generate_with_openssl_rand_base64_32
AUTH_URL=http://localhost:3000

# GitHub OAuth
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret

# Email (Resend recommended)
AUTH_RESEND_KEY=your_resend_api_key
EMAIL_FROM=noreply@ideaspace.lendi.org

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## 6. MONGOOSE MODELS (Complete Schemas)

### 6.1 User
```typescript
// src/models/User.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  username: string;
  name: string;
  avatarUrl?: string;
  role: "student" | "faculty" | "admin" | "mentor" | "judge" | "alumni";
  bio?: string;
  skills: string[];
  interests: string[];
  primaryTrack: string;
  secondaryTracks: string[];
  points: number;
  rankTier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite";
  githubUsername?: string;
  isOnboarded: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    role: {
      type: String,
      enum: ["student", "faculty", "admin", "mentor", "judge", "alumni"],
      default: "student",
    },
    bio: { type: String, maxlength: 300 },
    skills: [{ type: String }],
    interests: [{ type: String }],
    primaryTrack: { type: String, required: true, default: "ai-intelligent-systems" },
    secondaryTracks: [{ type: String }],
    points: { type: Number, default: 0 },
    rankTier: {
      type: String,
      enum: ["Bronze", "Silver", "Gold", "Platinum", "Elite"],
      default: "Bronze",
    },
    githubUsername: { type: String },
    isOnboarded: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ points: -1 });

export const User = mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);
```

### 6.2 Idea
```typescript
// src/models/Idea.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type IdeaStatus =
  | "draft"
  | "discovery"
  | "building"
  | "shipped"
  | "archived"
  | "rejected";

export interface IIdea extends Document {
  title: string;
  slug: string;
  problem: string;
  solution: string;
  track: string;
  tags: string[];
  status: IdeaStatus;
  healthScore: number;
  owner: Types.ObjectId;
  collaborators: Types.ObjectId[];
  skillsNeeded: string[];
  upvotes: number;
  views: number;
  coverImage?: string;
  githubUrl?: string;
  demoUrl?: string;
  isFeatured: boolean;
  proofCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const IdeaSchema = new Schema<IIdea>(
  {
    title: { type: String, required: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    problem: { type: String, required: true, maxlength: 600 },
    solution: { type: String, required: true, maxlength: 600 },
    track: { type: String, required: true },
    tags: [{ type: String }],
    status: {
      type: String,
      enum: ["draft", "discovery", "building", "shipped", "archived", "rejected"],
      default: "draft",
    },
    healthScore: { type: Number, default: 0, min: 0, max: 100 },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    skillsNeeded: [{ type: String }],
    upvotes: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    coverImage: { type: String },
    githubUrl: { type: String },
    demoUrl: { type: String },
    isFeatured: { type: Boolean, default: false },
    proofCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

IdeaSchema.index({ slug: 1 });
IdeaSchema.index({ owner: 1 });
IdeaSchema.index({ track: 1, status: 1 });
IdeaSchema.index({ upvotes: -1 });
IdeaSchema.index({ createdAt: -1 });

export const Idea = mongoose.models.Idea ?? mongoose.model<IIdea>("Idea", IdeaSchema);
```

### 6.3 Collaborator
```typescript
// src/models/Collaborator.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICollaborator extends Document {
  idea: Types.ObjectId;
  user: Types.ObjectId;
  role: "owner" | "member" | "observer";
  status: "pending" | "active" | "removed";
  joinedAt: Date;
}

const CollaboratorSchema = new Schema<ICollaborator>(
  {
    idea: { type: Schema.Types.ObjectId, ref: "Idea", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member", "observer"], default: "observer" },
    status: { type: String, enum: ["pending", "active", "removed"], default: "pending" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

CollaboratorSchema.index({ idea: 1, user: 1 }, { unique: true });

export const Collaborator =
  mongoose.models.Collaborator ??
  mongoose.model<ICollaborator>("Collaborator", CollaboratorSchema);
```

### 6.4 ProofEntry
```typescript
// src/models/ProofEntry.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type ProofType =
  | "github_commit"
  | "demo_link"
  | "presentation"
  | "build_log"
  | "external_validation"
  | "media_upload";

export interface IProofEntry extends Document {
  idea: Types.ObjectId;
  submittedBy: Types.ObjectId;
  type: ProofType;
  title: string;
  description?: string;
  evidenceUrl: string;
  thumbnailUrl?: string;
  isVerified: boolean;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  pointsAwarded: number;
  createdAt: Date;
}

const ProofEntrySchema = new Schema<IProofEntry>(
  {
    idea: { type: Schema.Types.ObjectId, ref: "Idea", required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["github_commit", "demo_link", "presentation", "build_log", "external_validation", "media_upload"],
      required: true,
    },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 400 },
    evidenceUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    isVerified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },
    pointsAwarded: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProofEntrySchema.index({ idea: 1 });
ProofEntrySchema.index({ submittedBy: 1 });
ProofEntrySchema.index({ isVerified: 1, createdAt: -1 });

export const ProofEntry =
  mongoose.models.ProofEntry ??
  mongoose.model<IProofEntry>("ProofEntry", ProofEntrySchema);
```

### 6.5 Workshop (Forge)
```typescript
// src/models/Workshop.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWorkshop extends Document {
  title: string;
  description: string;
  host: Types.ObjectId;
  coHosts: Types.ObjectId[];
  scheduledAt: Date;
  durationMins: number;
  location: string;
  isOnline: boolean;
  meetLink?: string;
  maxAttendees: number;
  rsvpList: Types.ObjectId[];
  demandSignals: number;
  track: string;
  status: "upcoming" | "live" | "completed" | "cancelled";
  coverImage?: string;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkshopSchema = new Schema<IWorkshop>(
  {
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 800 },
    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coHosts: [{ type: Schema.Types.ObjectId, ref: "User" }],
    scheduledAt: { type: Date, required: true },
    durationMins: { type: Number, default: 60 },
    location: { type: String, default: "Online" },
    isOnline: { type: Boolean, default: true },
    meetLink: { type: String },
    maxAttendees: { type: Number, default: 50 },
    rsvpList: [{ type: Schema.Types.ObjectId, ref: "User" }],
    demandSignals: { type: Number, default: 0 },
    track: { type: String, required: true },
    status: {
      type: String,
      enum: ["upcoming", "live", "completed", "cancelled"],
      default: "upcoming",
    },
    coverImage: { type: String },
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

WorkshopSchema.index({ scheduledAt: 1, status: 1 });
WorkshopSchema.index({ host: 1 });

export const Workshop =
  mongoose.models.Workshop ?? mongoose.model<IWorkshop>("Workshop", WorkshopSchema);
```

### 6.6 Bounty
```typescript
// src/models/Bounty.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IBounty extends Document {
  title: string;
  description: string;
  postedBy: Types.ObjectId;
  rewardPoints: number;
  kind: "build" | "research" | "design" | "mentor" | "judge";
  participationMode: "solo" | "team" | "either";
  deadlineAt: Date;
  status: "open" | "in_review" | "awarded" | "closed";
  submissions: Types.ObjectId[];
  winnerId?: Types.ObjectId;
  track: string;
  createdAt: Date;
  updatedAt: Date;
}

const BountySchema = new Schema<IBounty>(
  {
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 1000 },
    postedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rewardPoints: { type: Number, required: true },
    kind: {
      type: String,
      enum: ["build", "research", "design", "mentor", "judge"],
      required: true,
    },
    participationMode: { type: String, enum: ["solo", "team", "either"], default: "either" },
    deadlineAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["open", "in_review", "awarded", "closed"],
      default: "open",
    },
    submissions: [{ type: Schema.Types.ObjectId, ref: "User" }],
    winnerId: { type: Schema.Types.ObjectId, ref: "User" },
    track: { type: String, required: true },
  },
  { timestamps: true }
);

BountySchema.index({ status: 1, deadlineAt: 1 });

export const Bounty =
  mongoose.models.Bounty ?? mongoose.model<IBounty>("Bounty", BountySchema);
```

### 6.7 Archive (Postmortem)
```typescript
// src/models/Archive.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IArchive extends Document {
  idea: Types.ObjectId;
  title: string;
  outcome: "shipped" | "paused" | "failed" | "pivoted";
  whatWorked: string;
  whatFailed: string;
  lessons: string;
  forkedFrom?: Types.ObjectId;
  forkCount: number;
  author: Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
}

const ArchiveSchema = new Schema<IArchive>(
  {
    idea: { type: Schema.Types.ObjectId, ref: "Idea", required: true },
    title: { type: String, required: true, maxlength: 120 },
    outcome: {
      type: String,
      enum: ["shipped", "paused", "failed", "pivoted"],
      required: true,
    },
    whatWorked: { type: String, required: true, maxlength: 1000 },
    whatFailed: { type: String, required: true, maxlength: 1000 },
    lessons: { type: String, required: true, maxlength: 800 },
    forkedFrom: { type: Schema.Types.ObjectId, ref: "Archive" },
    forkCount: { type: Number, default: 0 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ArchiveSchema.index({ idea: 1 });
ArchiveSchema.index({ author: 1 });

export const Archive =
  mongoose.models.Archive ?? mongoose.model<IArchive>("Archive", ArchiveSchema);
```

### 6.8 Vote
```typescript
// src/models/Vote.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IVote extends Document {
  targetId: Types.ObjectId;
  targetType: "idea" | "proof" | "archive";
  voter: Types.ObjectId;
  value: 1 | -1;
  createdAt: Date;
}

const VoteSchema = new Schema<IVote>(
  {
    targetId: { type: Schema.Types.ObjectId, required: true, refPath: "targetType" },
    targetType: { type: String, enum: ["idea", "proof", "archive"], required: true },
    voter: { type: Schema.Types.ObjectId, ref: "User", required: true },
    value: { type: Number, enum: [1, -1], required: true },
  },
  { timestamps: true }
);

VoteSchema.index({ targetId: 1, targetType: 1, voter: 1 }, { unique: true });

export const Vote = mongoose.models.Vote ?? mongoose.model<IVote>("Vote", VoteSchema);
```

### 6.9 Notification
```typescript
// src/models/Notification.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export type NotificationType =
  | "collaborator_request"
  | "idea_upvoted"
  | "proof_verified"
  | "bounty_awarded"
  | "workshop_reminder"
  | "system_announcement";

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "collaborator_request",
        "idea_upvoted",
        "proof_verified",
        "bounty_awarded",
        "workshop_reminder",
        "system_announcement",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    linkUrl: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification ??
  mongoose.model<INotification>("Notification", NotificationSchema);
```

### 6.10 ReviewQueue
```typescript
// src/models/ReviewQueue.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReviewQueue extends Document {
  targetId: Types.ObjectId;
  targetType: "proof" | "idea" | "bounty_submission";
  reviewType: "milestone_verification" | "external_proof" | "content_report";
  status: "pending" | "in_review" | "approved" | "rejected";
  submittedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewQueueSchema = new Schema<IReviewQueue>(
  {
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      enum: ["proof", "idea", "bounty_submission"],
      required: true,
    },
    reviewType: {
      type: String,
      enum: ["milestone_verification", "external_proof", "content_report"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_review", "approved", "rejected"],
      default: "pending",
    },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

ReviewQueueSchema.index({ status: 1, createdAt: 1 });

export const ReviewQueue =
  mongoose.models.ReviewQueue ??
  mongoose.model<IReviewQueue>("ReviewQueue", ReviewQueueSchema);
```

### 6.11 Leaderboard (cached snapshot)
```typescript
// src/models/Leaderboard.ts
import mongoose, { Schema, Document, Types } from "mongoose";

export interface ILeaderboard extends Document {
  user: Types.ObjectId;
  points: number;
  rank: number;
  rankTier: string;
  period: "weekly" | "monthly" | "alltime";
  ideasShipped: number;
  proofsSubmitted: number;
  workshopsAttended: number;
  updatedAt: Date;
}

const LeaderboardSchema = new Schema<ILeaderboard>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    points: { type: Number, default: 0 },
    rank: { type: Number },
    rankTier: { type: String },
    period: { type: String, enum: ["weekly", "monthly", "alltime"], required: true },
    ideasShipped: { type: Number, default: 0 },
    proofsSubmitted: { type: Number, default: 0 },
    workshopsAttended: { type: Number, default: 0 },
  },
  { timestamps: true }
);

LeaderboardSchema.index({ period: 1, points: -1 });
LeaderboardSchema.index({ period: 1, user: 1 }, { unique: true });

export const Leaderboard =
  mongoose.models.Leaderboard ??
  mongoose.model<ILeaderboard>("Leaderboard", LeaderboardSchema);
```

---

## 7. NEXTAUTH.JS V5 SETUP

### 7.1 Auth config — `src/lib/auth.ts`
```typescript
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Resend from "next-auth/providers/resend";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "./mongodb-client";
import { connectDB } from "./db";
import { User } from "@/models/User";

const ALLOWED_EMAIL_DOMAINS = [
  "lendi.org",
  "lendi.edu.in",
  "liethub.org",
];

export function validateLendiEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain ?? "");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.EMAIL_FROM!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // GitHub users: validate email domain
      if (account?.provider === "github") {
        return validateLendiEmail(user.email);
      }
      // Magic link: validate domain before sending
      return validateLendiEmail(user.email);
    },
    async session({ session, user }) {
      await connectDB();
      const dbUser = await User.findOne({ email: user.email });
      if (dbUser) {
        session.user.id = dbUser._id.toString();
        session.user.role = dbUser.role;
        session.user.username = dbUser.username;
        session.user.isOnboarded = dbUser.isOnboarded;
        session.user.rankTier = dbUser.rankTier;
        session.user.points = dbUser.points;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
});
```

### 7.2 NextAuth session type augmentation — `src/types/next-auth.d.ts`
```typescript
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
      isOnboarded: boolean;
      rankTier: string;
      points: number;
    } & DefaultSession["user"];
  }
}
```

### 7.3 Route handler — `src/app/api/auth/[...nextauth]/route.ts`
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

### 7.4 Middleware — `src/middleware.ts`
```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/error", "/auth/verify"];
const ADMIN_PATHS = ["/admin"];
const REVIEWER_ROLES = ["faculty", "admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Not onboarded — redirect to onboarding
  if (!session.user.isOnboarded && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // Admin paths require admin role
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!REVIEWER_ROLES.includes(session.user.role)) {
      return NextResponse.redirect(new URL("/feed", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
```

---

## 8. PRODUCT CONFIGURATION

### `src/lib/product-config.ts`
```typescript
export const CORE_TRACKS = [
  { slug: "ai-intelligent-systems", label: "AI & Intelligent Systems" },
  { slug: "software-saas-platform", label: "Software, SaaS & Platform Engineering" },
  { slug: "mobile-consumer-apps", label: "Mobile & Consumer Applications" },
  { slug: "data-analytics", label: "Data, Analytics & Decision Systems" },
  { slug: "cybersecurity-cloud", label: "Cybersecurity, Cloud & Infrastructure" },
  { slug: "embedded-iot-robotics", label: "Embedded Systems, IoT & Robotics" },
  { slug: "ux-product-design", label: "UI/UX, Product & Experience Design" },
  { slug: "applied-campus-innovation", label: "Applied Engineering & Campus Innovation" },
] as const;

export const RANK_TIERS = ["Bronze", "Silver", "Gold", "Platinum", "Elite"] as const;

export const RANK_THRESHOLDS: Record<string, number> = {
  Bronze: 0,
  Silver: 200,
  Gold: 600,
  Platinum: 1500,
  Elite: 4000,
};

export type TrackSlug = (typeof CORE_TRACKS)[number]["slug"];
export type RankTier = (typeof RANK_TIERS)[number];
```

### `src/lib/score-config.ts`
```typescript
export const DAILY_POST_CAP = 5;

export const BASE_POINTS = {
  idea_published: 10,
  comment_created: 1,
  idea_upvoted_received: 2,
  collaborator_joined: 5,
  proof_submitted: 15,
  proof_verified: 30,
  bounty_completed: 50,
  milestone_confirmed: 40,
  workshop_attended: 8,
  workshop_hosted: 20,
  postmortem_published: 12,
} as const;

export type ScoreEvent = keyof typeof BASE_POINTS;

export function getBasePointsForEvent(event: ScoreEvent): number {
  return BASE_POINTS[event];
}
```

### `src/lib/health-score.ts`
```typescript
// Health score algorithm — idea completeness (0-100)
export interface IdeaHealthInput {
  title: string;
  problem: string;
  solution: string;
  tags: string[];
  skillsNeeded: string[];
  githubUrl?: string;
  demoUrl?: string;
  coverImage?: string;
}

export function computeHealthScore(idea: IdeaHealthInput): number {
  let score = 0;

  if (idea.title.length >= 10) score += 15;
  if (idea.problem.length >= 80) score += 20;
  if (idea.solution.length >= 80) score += 20;
  if (idea.tags.length >= 2) score += 10;
  if (idea.skillsNeeded.length >= 1) score += 10;
  if (idea.githubUrl) score += 10;
  if (idea.demoUrl) score += 10;
  if (idea.coverImage) score += 5;

  return Math.min(score, 100);
}
```

---

## 9. DESIGN SYSTEM

### 9.1 Color tokens — `src/app/globals.css`
```css
@import "tailwindcss";

@layer base {
  :root {
    /* Neutrals */
    --ink-900: #0B0F14;
    --ink-700: #1C2430;
    --ink-500: #3B485A;
    --ink-300: #6C7A8F;
    --ink-100: #C9D1DC;
    --canvas-0: #F7F3EC;
    --canvas-50: #EFE8DE;

    /* Accents */
    --teal-500: #1FB7A6;
    --teal-700: #128A7B;
    --ember-500: #FF6B4A;
    --ember-700: #D95236;
    --lime-400: #C7E85B;

    /* Semantic */
    --success: #2EA86A;
    --warning: #F2B24B;
    --danger: #E5484D;
    --info: #3D8BFF;

    /* App surfaces */
    --bg: var(--canvas-0);
    --bg-surface: #FFFFFF;
    --bg-muted: var(--canvas-50);
    --fg: var(--ink-900);
    --fg-muted: var(--ink-300);
    --border: var(--ink-100);
    --accent: var(--teal-500);
    --accent-hover: var(--teal-700);
  }

  [data-theme="dark"] {
    --bg: var(--ink-900);
    --bg-surface: var(--ink-700);
    --bg-muted: #111823;
    --fg: #F1F4F8;
    --fg-muted: var(--ink-300);
    --border: var(--ink-500);
  }
}
```

### 9.2 Tailwind config — `tailwind.config.ts`
```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "var(--ink-900)",
          700: "var(--ink-700)",
          500: "var(--ink-500)",
          300: "var(--ink-300)",
          100: "var(--ink-100)",
        },
        canvas: {
          0: "var(--canvas-0)",
          50: "var(--canvas-50)",
        },
        teal: { 500: "var(--teal-500)", 700: "var(--teal-700)" },
        ember: { 500: "var(--ember-500)", 700: "var(--ember-700)" },
        lime: { 400: "var(--lime-400)" },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
        bg: "var(--bg)",
        surface: "var(--bg-surface)",
        muted: "var(--bg-muted)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        border: "var(--border)",
        accent: "var(--accent)",
      },
      fontFamily: {
        display: ["Sora", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-1": ["48px", { lineHeight: "56px", fontWeight: "700" }],
        "display-2": ["36px", { lineHeight: "44px", fontWeight: "600" }],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "10px",
        lg: "16px",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
} satisfies Config;
```

### 9.3 Typography
Load in `src/app/layout.tsx`:
```typescript
import { Sora, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
```

### 9.4 Motion constants
```typescript
// src/lib/utils.ts (motion variants for Framer Motion)
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 0.61, 0.36, 1] } },
};

export const staggerChildren = {
  visible: { transition: { staggerChildren: 0.07 } },
};
```

---

## 10. API ROUTES

All routes live in `src/app/api/`. Every route must:
- Import and call `connectDB()` before any DB operation
- Validate input with a Zod schema
- Return structured JSON: `{ data, error, meta }`
- Handle errors with try/catch and appropriate status codes

### Ideas
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/ideas | Any | List ideas with filters + pagination |
| POST | /api/ideas | student+ | Create new idea |
| GET | /api/ideas/[id] | Any | Get idea by ID |
| PATCH | /api/ideas/[id] | owner | Update idea |
| DELETE | /api/ideas/[id] | owner/admin | Delete idea |
| POST | /api/ideas/[id]/upvote | student+ | Toggle upvote |
| POST | /api/ideas/[id]/collaborate | student+ | Request to join |

### Proof
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/proof | Any | List verified proofs (wall) |
| POST | /api/proof | student+ | Submit proof entry |
| PATCH | /api/proof/[id]/verify | faculty/admin | Verify proof + award points |

### Users + Profiles
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/users/[username] | Any | Get public profile |
| PATCH | /api/users/me | self | Update own profile |
| POST | /api/users/me/onboard | self | Complete onboarding |

### Forge (Workshops)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/workshops | Any | List workshops |
| POST | /api/workshops | faculty+ | Create workshop |
| POST | /api/workshops/[id]/rsvp | student+ | Toggle RSVP |
| POST | /api/workshops/[id]/demand | student+ | Add demand signal |

### Bounties
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/bounties | Any | List open bounties |
| POST | /api/bounties | faculty/admin | Create bounty |
| POST | /api/bounties/[id]/submit | student+ | Submit entry |

### Archive
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/archive | Any | List public postmortems |
| POST | /api/archive | owner | Create postmortem |
| POST | /api/archive/[id]/fork | student+ | Fork an archive entry |

### Leaderboard
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/leaderboard | Any | Get leaderboard for period |

### Notifications
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/notifications | self | Get own notifications |
| PATCH | /api/notifications/[id]/read | self | Mark read |
| PATCH | /api/notifications/read-all | self | Mark all read |

### Admin
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /api/admin/review | admin/faculty | Get review queue |
| PATCH | /api/admin/review/[id] | admin/faculty | Update review status |
| GET | /api/admin/users | admin | List all users |
| PATCH | /api/admin/users/[id]/role | admin | Update user role |

---

## 11. SCREEN SPECIFICATIONS

### Screen 1 — Landing (`/`)
**Layout:** Full-width, no sidebar. Navbar + sections.

**Sections in order:**
1. **Navbar** — Logo left, nav links center, "Sign in" + "Join" right
2. **Hero** — `display-1` headline. Subtext. Two CTAs (Join / Browse Ideas). Background: subtle grain texture on canvas-0, teal accent line left of headline.
3. **Proof Pipeline** — "How it works": 3 steps with status chips: `POST → BUILD → VERIFY`. Each step has icon, title, description.
4. **Outcome Stats KPI strip** — 4 live numbers: Ideas posted, Builds shipped, Workshops run, Hours saved (pull from DB on SSR)
5. **Evidence Wall preview** — 6 verified proof cards in a masonry grid. "View all →" link.
6. **Comparison table** — IdeaSpace vs WhatsApp groups / Google Forms / Discord
7. **Campus partners strip** — Logos/names of clubs, labs, departments
8. **Final CTA** — Large centered CTA to join
9. **Footer** — Links, legal, social

### Screen 2 — Auth Login (`/auth/login`)
**Layout:** Centered card on canvas-0 bg. No sidebar.
- Logo above card
- "Sign in with GitHub" primary button
- Divider "or"
- Email input + "Send magic link" button
- Subtext: "Only approved @lendi.org and @lendi.edu.in accounts."

### Screen 3 — Onboarding (`/onboarding`)
**Layout:** Centered 3-step wizard. Progress dots top.
- Step 1: Name, username, bio (max 300 chars)
- Step 2: Skills (tag picker), interests (tag picker)
- Step 3: Primary track (required), secondary tracks (up to 2)
- Each step has Next/Back buttons
- On complete: POST `/api/users/me/onboard`, redirect to `/feed`

### Screen 4 — Feed (`/feed`)
**Layout:** App shell (sidebar + header). Main area: filter rail + idea card grid.
- **Filter rail** — Track filter, Status filter (discovery/building/shipped), Sort (latest/trending/top), Search
- **KPI strip** — Total ideas, Active builds, Shipped this month
- **Idea card grid** — 2 col desktop, 1 col mobile. Each card: Cover image, Status pill, Title, Problem preview, Tags, Owner avatar, Upvote count, Collaborator stack, Health score bar

### Screen 5 — Idea Detail (`/ideas/[id]`)
**Layout:** App shell. 2-col: main content left (8/12), sidebar right (4/12).

**Left:**
- Status pill + track badge
- Title (display-2)
- Problem section, Solution section
- Skills needed badges
- Contributor stack + "Request to join" button
- Activity feed (comments + updates)

**Right:**
- Owner card
- Health score widget (circular, 0-100)
- Proof Rail (timeline of verified proofs)
- GitHub / Demo links
- Upvote button + count

### Screen 6 — Create Idea (`/ideas/new`)
**Layout:** App shell. Single-column centered form, 720px max-width.
- Guided sections with labels and help text
- Live Health Score widget (updates as form fills)
- Fields: Title, Problem, Solution, Track (required), Tags, Skills needed, GitHub URL, Demo URL, Cover image upload
- Publish checklist on right: health score gate (min 40 to publish)
- Actions: "Save draft" + "Publish"

### Screen 7 — Forge (`/forge`)
**Layout:** App shell. Upcoming workshops grid + demand signals panel.
- Workshop cards: Cover, Title, Host, Date, RSVP count, Status chip
- "Demand signal" button for ideas not yet scheduled as workshops
- Filter: track, upcoming/completed

### Screen 8 — Workshop Detail (`/forge/[id]`)
**Layout:** App shell. Hero + details + RSVP module.
- Host profile card, date/time/location
- RSVP button with count
- Attendee avatars
- Recording embed (if completed)

### Screen 9 — Proof Wall (`/wall`)
**Layout:** App shell. Masonry grid of proof cards.
- Filter: category, verified only, track, date range
- Proof card: Thumbnail, Type badge (GitHub/Demo/etc), Idea title, Submitter, Verified tick, Timestamp
- "Submit Proof" button for idea owners

### Screen 10 — Archive (`/archive`)
**Layout:** App shell. List of postmortems.
- Outcome filter: shipped / paused / failed / pivoted
- Archive card: Outcome badge, Title, Lessons preview, Fork count, "Fork & Adopt" CTA

### Screen 11 — Leaderboard (`/leaderboard`)
**Layout:** App shell. Period tabs (weekly/monthly/all-time) + ranked rows.
- KPI strip: Total participants, Points awarded this month, Top track
- Leaderboard row: Rank number, Avatar + name + username, Rank badge, Points, Trend chip (+/-)
- Highlight own row in teal

### Screen 12 — Bounties (`/bounties`)
**Layout:** App shell. Bounty card grid.
- Filter: kind (build/research/design), status (open/closed), track
- Bounty card: Kind badge, Title, Description preview, Reward points, Deadline countdown, Participation mode
- CTA: "View details" → `/bounties/[id]`

### Screen 13 — Profile (`/profile/[username]`)
**Layout:** App shell. Profile header + tabbed content.
- Header: Avatar, Name, Username, Bio, Skills, Points, Rank badge, GitHub link
- Tabs: Ideas (posted), Contributions, Proof, Activity
- Stats strip: Ideas posted, Proofs submitted, Workshops attended, Points earned

### Screen 14 — Notifications (`/notifications`)
**Layout:** App shell. Compact notification list.
- Unread count badge on sidebar icon
- "Mark all read" button
- Notification row: Icon by type, Title, Body, Link, Timestamp, Read indicator

### Screen 15 — Admin (`/admin`)
**Access:** faculty, admin only.

**Sub-pages:**
- `/admin` — Dashboard: pending reviews count, recent reports, new users
- `/admin/review` — ReviewQueueTable: filter by type and status, approve/reject actions
- `/admin/users` — UserTable: search, role change, verify, ban
- `/admin/reports` — ReportCard list: flag reason, reporter, target, action buttons

---

## 12. SHARED UI COMPONENTS (Implementation guide)

### Button
```typescript
// Variants: primary | secondary | ghost | danger
// Sizes: sm | md | lg
// States: loading (spinner inside), disabled
```

### IdeaStatusPill
```typescript
// Values: draft | discovery | building | shipped | archived
// Colors: ink-300 | info | warning | success | ember-500
```

### HealthScoreWidget
```typescript
// Circular SVG gauge, 0-100
// Color: danger <40, warning 40-70, success >70
// Animated fill using Framer Motion
```

### ProofRail
```typescript
// Vertical timeline of ProofEntry items
// Each node: type icon, title, verified tick, timestamp
// Animate entry with staggerChildren
```

### Skeleton
```typescript
// Must match exact shape of real component
// Use animate-pulse Tailwind class
// Never use a spinner where a skeleton fits better
```

### EmptyState
```typescript
// Props: illustration (SVG), heading, subtext, ctaLabel, ctaHref
// Every list and grid page must have an EmptyState fallback
```

---

## 13. PHASED MILESTONE PLAN

### Phase 0 — Foundation (Day 1-2)
- [ ] Next.js 15 project init with TypeScript + Tailwind v4
- [ ] MongoDB Atlas cluster + connection singleton
- [ ] All 11 Mongoose models created and indexed
- [ ] NextAuth.js v5 setup with GitHub + Resend
- [ ] Institutional email validation + tests
- [ ] Middleware for route protection
- [ ] `product-config.ts`, `score-config.ts`, `health-score.ts`
- [ ] Unit tests for auth, scoring, tracks, health score
- [ ] Vitest + Playwright configured

**Gate:** `npm run build` passes. All unit tests green.

### Phase 1 — Core screens (Day 3-6)
- [ ] Design system tokens in globals.css + tailwind.config.ts
- [ ] Font setup with next/font/google
- [ ] All base UI components in `src/components/ui/`
- [ ] App shell (sidebar, header, mobile nav)
- [ ] Landing page (all sections)
- [ ] Auth/login + magic link verify + error page
- [ ] Onboarding wizard (3 steps)
- [ ] Feed page with filter rail + idea cards
- [ ] Create idea form with live health score
- [ ] Idea detail page with proof timeline

**Gate:** Full auth flow works end-to-end. Feed loads real ideas from DB.

### Phase 2 — Proof and reputation (Day 7-9)
- [ ] Proof wall with submit modal + verification flow
- [ ] Archive + postmortem form + fork action
- [ ] Leaderboard with period tabs (weekly/monthly/all-time)
- [ ] Vote API + upvote interaction on idea cards
- [ ] Score event tracking — award points on every action
- [ ] Rank tier auto-update after point events
- [ ] Notification system — create + list + mark read

**Gate:** Submit proof → faculty verifies → points awarded → leaderboard updates.

### Phase 3 — Institutional layer (Day 10-12)
- [ ] Forge (workshops) — list, detail, RSVP
- [ ] Bounties — list, detail, submit
- [ ] Admin dashboard + review queue table
- [ ] Role management in admin users page
- [ ] Content reports and moderation actions
- [ ] E2E tests for all primary flows

**Gate:** Full e2e test suite green. Production build passes.

### Phase 4 — Polish and launch (Day 13-14)
- [ ] Framer Motion page transitions
- [ ] GSAP hero animation on landing
- [ ] Skeleton loaders on all async components
- [ ] Empty states on all list pages
- [ ] Mobile responsiveness audit (all pages)
- [ ] WCAG AA contrast check on all color pairs
- [ ] Lighthouse score: LCP < 2.5s, CLS < 0.1
- [ ] Deploy to Vercel + MongoDB Atlas production cluster

---

## 14. TESTING REQUIREMENTS

### Unit tests (`tests/unit/`)
Required coverage:
- `validateLendiEmail` — all domain rules
- `computeHealthScore` — all criteria permutations
- `getBasePointsForEvent` — all event types
- `CORE_TRACKS` — length and slugs
- `RANK_THRESHOLDS` — tier boundaries

### E2E tests (`tests/e2e/`)
Required flows:
- Landing → login → onboarding → feed
- Create idea → publish → appear on feed
- Submit proof → verify (as faculty) → points awarded
- RSVP workshop → appear in attendee list
- Admin review queue → approve → notification sent

---

## 15. DEPLOYMENT CHECKLIST

Before going live:
- [ ] All env vars set in Vercel (MONGODB_URI, AUTH_*, CLOUDINARY_*)
- [ ] MongoDB Atlas IP whitelist includes Vercel IPs (or allow all: 0.0.0.0/0 for free tier)
- [ ] AUTH_URL set to production domain
- [ ] Indexes confirmed in Atlas dashboard
- [ ] GitHub OAuth app callback URL updated to production domain
- [ ] Resend domain verified for email delivery
- [ ] Error monitoring configured (Sentry recommended)
- [ ] `npm run build` passes on CI before merge to main

---

*End of IDEASPACE ULTRA MASTER BUILD PROMPT v2.0*
*Rebuild on MongoDB Atlas. No shortcuts. Prove the work.*
