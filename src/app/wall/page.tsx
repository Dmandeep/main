"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, ExternalLink, FileText, GitBranch, ShieldCheck, Video } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkStamp } from "@/components/marks";

/**
 * The Proof Wall.
 *
 * ART-DIRECTION-V2.md calls the ledger the product's only defensible asset and
 * the new centre of gravity. This is where it is visible: every piece of work
 * the department got signed off, who did it, and — the part that makes it mean
 * anything — who put their name to verifying it.
 *
 * Both names are shown on every row. A verification with an anonymous verifier
 * is an assertion; with a name on it, it is a record someone is accountable
 * for. That is the whole difference between this and a feed of screenshots.
 *
 * The previous version read `pointsAwarded` and `submittedBy.rankTier`, which
 * this endpoint has never returned, so every avatar rendered untiered and a
 * points line rendered nothing at all.
 */

interface Proof {
  _id: string;
  title: string;
  type: string;
  evidenceUrl: string;
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  idea: { title: string; slug: string; track: string };
  submittedBy: { name: string; username: string; avatarUrl?: string };
  overallScore?: number | null;
}

const SOURCE_ICON: Record<string, React.ElementType> = {
  github_commit: GitBranch,
  github_pr: GitBranch,
  deployed_url: ExternalLink,
  video: Video,
  document: FileText,
};

const SOURCE_LABEL: Record<string, string> = {
  github_commit: "Commit",
  github_pr: "Pull request",
  deployed_url: "Deployed",
  video: "Recording",
  document: "Document",
};

export default function ProofWallPage() {
  const [onlyVerified, setOnlyVerified] = useState(true);

  const { data: proofs = [], isPending } = useQuery<Proof[]>({
    queryKey: ["wall"],
    queryFn: async () => {
      const res = await fetch("/api/wall");
      if (!res.ok) throw new Error("Could not load the proof wall");
      return (await res.json()).data ?? [];
    },
  });

  const shown = onlyVerified ? proofs.filter((p) => p.isVerified) : proofs;
  const verifiedCount = proofs.filter((p) => p.isVerified).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl pb-24">
        <header className="mb-8 flex items-start gap-5">
          <MarkStamp className="hidden h-16 w-16 shrink-0 text-stamp-verified sm:block" />
          <div>
            <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
              The Proof Wall
            </h1>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-700">
              Everything this department has actually shipped, with the name of whoever signed it
              off. Nothing reaches this wall because someone said so.
            </p>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setOnlyVerified(true)}
            aria-pressed={onlyVerified}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              onlyVerified
                ? "border-stamp-verified bg-stamp-verified text-paper-0"
                : "border-rule text-ink-700 hover:border-ink-300"
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            type="button"
            onClick={() => setOnlyVerified(false)}
            aria-pressed={!onlyVerified}
            className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              !onlyVerified
                ? "border-ink-900 bg-ink-900 text-paper-0"
                : "border-rule text-ink-700 hover:border-ink-300"
            }`}
          >
            Everything submitted ({proofs.length})
          </button>
        </div>

        {isPending ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            mark={MarkStamp}
            title={onlyVerified ? "Nothing verified yet" : "Nothing submitted yet"}
            description="Attach a commit, a deploy or a recording to a project and a faculty member reviews it. What they sign lands here."
            action={{ label: "See what is being built", href: "/feed" }}
          />
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-[var(--radius-lg)] border border-rule">
            {shown.map((p, i) => {
              const Icon = SOURCE_ICON[p.type] ?? FileText;

              return (
                <motion.li
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                  className="group bg-paper-0 p-5 transition-colors hover:bg-paper-1/50"
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm ${
                        p.isVerified
                          ? "border-emerald-300 bg-emerald-50 text-emerald-600"
                          : "border-rule bg-paper-1 text-ink-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <div className="flex items-baseline gap-x-2">
                          <a
                            href={p.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-display text-lg font-bold text-ink-900 hover:text-stamp-verified hover:underline"
                          >
                            {p.title}
                          </a>
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500 px-2 py-0.5 rounded-full border border-rule bg-paper-1">
                            {SOURCE_LABEL[p.type] ?? p.type}
                          </span>
                        </div>
                        {p.overallScore != null && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 shadow-sm">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Score</span>
                            <span className="text-sm font-display font-black text-amber-600">{p.overallScore}/100</span>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/ideas/${p.idea.slug}`}
                        className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-ink-700 hover:text-stamp-verified"
                      >
                        {p.idea.title}
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                          href={`/profile/${p.submittedBy.username}`}
                          className="flex items-center gap-2 text-[13px] text-ink-700 hover:text-ink-900"
                        >
                          <Avatar
                            name={p.submittedBy.name}
                            src={p.submittedBy.avatarUrl}
                            size="sm"
                          />
                          {p.submittedBy.name}
                        </Link>

                        {/* The second name is the point. A verification nobody
                            signed is just a claim with a tick on it. */}
                        {p.isVerified && p.verifiedBy ? (
                          <span className="flex items-center gap-1.5 text-[13px] font-medium text-stamp-verified">
                            <ShieldCheck className="h-4 w-4" />
                            signed by {p.verifiedBy}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-500">
                            Awaiting a reviewer
                          </span>
                        )}

                        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500">
                          {formatDistanceToNowStrict(
                            new Date(p.verifiedAt ?? p.createdAt),
                            { addSuffix: true }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
