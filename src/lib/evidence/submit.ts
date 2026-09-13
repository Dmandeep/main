import { createHash } from "node:crypto";
import { Prisma, SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Classify a submitted URL into an evidence source.
 *
 * The external id matters more than the type: it is half of the uniqueness
 * constraint that makes the same commit unsubmittable twice.
 */
export function classifySource(url: string): {
  sourceType: SourceType;
  externalId: string | null;
} {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { sourceType: "DOCUMENT", externalId: null };
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const path = parsed.pathname;

  if (host === "github.com") {
    const pr = path.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (pr) return { sourceType: "GITHUB_PR", externalId: `${pr[1]}/${pr[2]}#${pr[3]}` };

    const commit = path.match(/^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/i);
    if (commit)
      return { sourceType: "GITHUB_COMMIT", externalId: `${commit[1]}/${commit[2]}@${commit[3]}` };

    const release = path.match(/^\/([^/]+)\/([^/]+)\/releases\/tag\/(.+)/);
    if (release)
      return { sourceType: "GITHUB_RELEASE", externalId: `${release[1]}/${release[2]}:${release[3]}` };

    return { sourceType: "DOCUMENT", externalId: `${host}${path}` };
  }

  if (host.endsWith("figma.com")) return { sourceType: "DESIGN_FILE", externalId: `${host}${path}` };
  if (host.endsWith("youtube.com") || host === "youtu.be")
    return { sourceType: "MEDIA", externalId: `${host}${path}${parsed.search}` };
  if (host.endsWith("arxiv.org")) return { sourceType: "RESEARCH_OUTPUT", externalId: `${host}${path}` };

  // A bare origin is a deployment; a deep link is a document.
  if (path === "/" || path === "") return { sourceType: "DEPLOYED_URL", externalId: host };
  return { sourceType: "DOCUMENT", externalId: `${host}${path}` };
}

/**
 * Blocks private and link-local ranges before the server fetches a URL.
 *
 * Evidence submission hands the server an attacker-chosen URL, which is the
 * textbook SSRF setup: without this, a student could point evidence at the
 * cloud metadata endpoint and have the server fetch credentials for them.
 */
export function isFetchableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }

  // Literal IPs in private space. DNS names that resolve into private space
  // still need resolution-time checks in the fetcher; this is the cheap
  // first gate, not the whole defence.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 169 && b === 254) return false; // link-local, incl. 169.254.169.254
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return false;

  return true;
}

export interface SubmitEvidenceInput {
  tenantId: string;
  projectId: string;
  creatorId: string;
  title: string;
  url: string;
  description?: string;
  milestoneId?: string;
}

export type SubmitEvidenceResult =
  | { status: "created"; evidenceId: string }
  | { status: "duplicate"; reason: string }
  | { status: "rejected"; reason: string };

/**
 * Record a piece of evidence.
 *
 * Submission does not award standing. Only verification does — see
 * src/lib/standing/award.ts. That separation is the entire point: if
 * submitting scored, the ledger would measure typing.
 */
export async function submitEvidence(
  input: SubmitEvidenceInput
): Promise<SubmitEvidenceResult> {
  if (!isFetchableUrl(input.url)) {
    return {
      status: "rejected",
      reason: "That URL is not accepted. Use a public http(s) link.",
    };
  }

  const { sourceType, externalId } = classifySource(input.url);

  // Hash the normalised URL now. Once a fetcher exists this becomes the hash
  // of the captured payload, and `parserVersion` says which produced it.
  const contentHash = `sha256:${createHash("sha256").update(input.url.trim()).digest("hex").slice(0, 48)}`;

  try {
    const evidence = await prisma.evidence.create({
      data: {
        projectId: input.projectId,
        milestoneId: input.milestoneId ?? null,
        creatorId: input.creatorId,
        title: input.title,
        description: input.description ?? null,
        sourceType,
        sourceUrl: input.url,
        sourceExternalId: externalId,
        contentHash,
        parserVersion: "1",
        state: "SUBMITTED",
      },
      select: { id: true },
    });

    logger.info("Evidence submitted", {
      evidenceId: evidence.id,
      projectId: input.projectId,
      sourceType,
    });

    return { status: "created", evidenceId: evidence.id };
  } catch (error) {
    // Unique on (projectId, sourceType, sourceExternalId). Resubmitting the
    // same artefact is refused by the database, not by a later review.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        status: "duplicate",
        reason: "That artefact has already been submitted to this project.",
      };
    }
    throw error;
  }
}
