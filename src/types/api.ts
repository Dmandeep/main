/**
 * Shapes returned by the route handlers under `src/app/api` and consumed by
 * client components. These are hand-written because the API serialises Mongoose
 * documents to JSON (`_id` as a string, dates as ISO strings), so the model
 * interfaces in `src/models` do not describe what the browser receives.
 */
import type { IdeaStatus, RankTier, UserRole } from "@/types";
import type { Collaborator } from "@/components/ui/CollaboratorStack";

export interface UserRef {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  rankTier?: RankTier;
}

export interface IdeaSummary {
  _id: string;
  slug?: string;
  title: string;
  problem: string;
  status: IdeaStatus;
  healthScore: number;
  tags: string[];
  collaborators: Collaborator[];
  coverImage?: string;
  upvotes?: number;
  createdAt?: string;
}

export interface ProjectTeamMember {
  _id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  /** What they do on this project, in their own words. */
  role: string;
  joinedAt: string;
  isOwner: boolean;
}

export interface IdeaDetail extends IdeaSummary {
  tagline?: string;
  /** The team with roles, so "who does the UI here" is answerable. */
  team?: ProjectTeamMember[];
  /** What this viewer is to this project. */
  viewer?: {
    isOwner: boolean;
    isMember: boolean;
    /** Their own outstanding request, so the page never offers to ask twice. */
    joinRequest: { _id: string; status: string; role: string } | null;
  };
  solution: string;
  track: string;
  views: number;
  upvotes: number;
  createdAt: string;
  owner: UserRef;
  skillsNeeded: string[];
  githubUrl?: string;
  demoUrl?: string;
}

export type ProofStatus = "pending" | "approved" | "rejected";

export interface ProofItem {
  _id: string;
  title: string;
  url: string;
  type: string;
  status: ProofStatus;
  description?: string;
  pointsAwarded: number;
  createdAt: string;
  submitter: UserRef;
}

export interface JoinRequestItem {
  _id: string;
  role: string;
  message?: string;
  userId: UserRef;
}

export interface ProfileTagSummary {
  _id: string;
  label: string;
  /** "self" | "earned" | "community" | "faculty" */
  source: string;
  sourceRef?: string;
}

export interface ProfileLinkSummary {
  _id: string;
  platform: string;
  handle: string;
  isVerified: boolean;
  statLabel?: string;
  statValue?: string;
}

export interface PublicProfile {
  _id: string;
  name: string;
  username: string;
  bio?: string;
  role: UserRole;
  rankTier: RankTier;
  points: number;
  primaryTrack: string;
  branch?: string;
  year?: number;
  githubUsername?: string;
  /**
   * Never populated by the API. Kept only so the two profile cards that read
   * them do not break; both were replaced by `tags` and `links`, which carry
   * real data and its provenance.
   */
  skills: string[];
  interests: string[];
  /** Self-chosen and system-issued tags, each carrying which it is. */
  tags: ProfileTagSummary[];
  /** Claimed accounts elsewhere. Only GitHub can be verified. */
  links: ProfileLinkSummary[];
  createdAt: string;
  forgedIdeas: IdeaSummary[];
  collaboratedIdeas: IdeaSummary[];
}
