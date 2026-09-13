/**
 * The single health-score implementation.
 *
 * Three competing versions previously existed — `health-score.ts`
 * (`computeHealthScore`), `healthScore.ts` (`calculateHealthScore`) and a dead
 * `health.ts`. `/api/ideas` scored submissions with one of them while
 * `/ideas/new` previewed a different one, so the number a student saw before
 * publishing was not the number the 60-point publish gate applied. This module
 * keeps the server-authoritative algorithm; the other two are deleted.
 *
 * Note: this measures how complete the brief is, not whether the idea is good.
 */
export interface IdeaDataForScore {
  title?: string;
  tagline?: string;
  problem?: string;
  solution?: string;
  tags?: string[];
  track?: string;
  coverImage?: string;
  collaboratorsCount?: number;
  githubUrl?: string;
  demoUrl?: string;
}

/**
 * Calculates the Idea Health Score based on completeness of fields.
 * Total possible: 100 points
 * 
 * Breakdown:
 * Title (length > 5): 10 pts
 * Tagline (length > 10): 10 pts
 * Problem (length > 50): 15 pts
 * Solution (length > 50): 15 pts
 * Tags (min 2): 5 pts
 * Category/Track (selected): 10 pts
 * Cover Image (exists): 10 pts
 * Team Size (collaborators > 1): 5 pts
 * External Links (github or demo): 10 pts
 * Total: 90 pts. (Adding 10 more to Problem/Solution to reach 100) -> Problem(20), Solution(20).
 */
export function calculateHealthScore(data: IdeaDataForScore): number {
  let score = 0;

  if (data.title && data.title.trim().length >= 5) score += 10;
  if (data.tagline && data.tagline.trim().length >= 10) score += 10;
  if (data.problem && data.problem.trim().length >= 50) score += 20;
  if (data.solution && data.solution.trim().length >= 50) score += 20;
  
  if (data.tags && data.tags.length >= 2) score += 5;
  if (data.track && data.track.trim().length > 0) score += 10;
  if (data.coverImage && data.coverImage.trim().length > 0) score += 10;
  
  // For team size, the owner is 1, so collaboratorsCount > 0 means > 1 total team members
  if (data.collaboratorsCount !== undefined && data.collaboratorsCount > 0) score += 5;
  
  if ((data.githubUrl && data.githubUrl.trim().length > 0) || (data.demoUrl && data.demoUrl.trim().length > 0)) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

export function getHealthColor(score: number): string {
  if (score < 40) return "danger";
  if (score < 70) return "warning";
  return "success";
}

export function getHealthLabel(score: number): string {
  if (score < 40) return "Needs Work";
  if (score < 70) return "Getting There";
  return "Healthy";
}
