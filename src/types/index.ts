export type IdeaStatus =
  | "draft"
  | "discovery"
  | "building"
  | "shipped"
  | "archived"
  | "rejected";

export type ProofType =
  | "github_commit"
  | "demo_link"
  | "presentation"
  | "build_log"
  | "external_validation"
  | "media_upload";

export type UserRole = "student" | "faculty" | "admin" | "mentor" | "judge" | "alumni";

export type RankTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Elite";

export type WorkshopStatus = "upcoming" | "live" | "completed" | "cancelled";

export type BountyKind = "build" | "research" | "design" | "mentor" | "judge";

export type BountyStatus = "open" | "in_review" | "awarded" | "closed";

export type ArchiveOutcome = "shipped" | "paused" | "failed" | "pivoted";

export const CORE_TRACKS = [
  { slug: "ai-intelligent-systems", label: "AI & Intelligent Systems" },
  { slug: "software-saas-platform", label: "Software & SaaS" },
  { slug: "mobile-consumer-apps", label: "Mobile & Consumer Apps" },
  { slug: "data-analytics", label: "Data & Analytics" },
  { slug: "cybersecurity-cloud", label: "Cybersecurity & Cloud" },
  { slug: "embedded-iot-robotics", label: "IoT & Robotics" },
  { slug: "ux-product-design", label: "UI/UX & Design" },
  { slug: "applied-campus-innovation", label: "Campus Innovation" },
] as const;

export type TrackSlug = (typeof CORE_TRACKS)[number]["slug"];

export const STATUS_COLORS: Record<IdeaStatus, string> = {
  draft: "secondary",
  discovery: "info",
  building: "warning",
  shipped: "success",
  archived: "danger",
  rejected: "danger",
};

export const RANK_COLORS: Record<RankTier, string> = {
  Bronze: "#A0826D",
  Silver: "#9CA3AF",
  Gold: "#F59E0B",
  Platinum: "#22D3EE",
  Elite: "#8B5CF6",
};
