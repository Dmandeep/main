"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, ShieldCheck, Sprout } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkCard, MarkHandoff } from "@/components/marks";

/**
 * The Archive.
 *
 * This page was broken outright: it read `whatWorked`, `whatFailed`,
 * `forkCount` and `createdAt`, none of which `/api/archive` has ever returned,
 * so `a.whatWorked.slice(0, 150)` threw on undefined and the whole route blew
 * up at render. Rebuilt against the payload that actually exists.
 *
 * The framing matters as much as the fix. A list of dead projects is a
 * graveyard; the reason this surface exists is that every row can be picked
 * up. So the postmortem is the body, what survived is stated in verified
 * evidence, and the action on every card is to continue it — a revival
 * inherits the original's lineage rather than starting from nothing.
 */

interface ArchiveEntry {
  _id: string;
  slug: string;
  title: string;
  track: string | null;
  problem: string;
  lessons: string;
  postmortem: string;
  outcome: string;
  archivedAt: string | null;
  verifiedEvidenceCount: number;
  revivedBy: { id: string; slug: string; title: string }[];
  idea: { title: string; slug: string; track: string | null };
  author: { name: string; username: string; avatarUrl?: string };
}

const OUTCOME: Record<
  string,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" }
> = {
  SHIPPED: { label: "Shipped", variant: "success" },
  PAUSED: { label: "Paused", variant: "warning" },
  ABANDONED: { label: "Abandoned", variant: "danger" },
  FAILED: { label: "Did not work", variant: "danger" },
  PIVOTED: { label: "Pivoted", variant: "info" },
};

export default function ArchivePage() {
  const { data: archives = [], isPending } = useQuery<ArchiveEntry[]>({
    queryKey: ["archive"],
    queryFn: async () => {
      const res = await fetch("/api/archive");
      if (!res.ok) throw new Error("Failed to load the archive");
      return (await res.json()).data ?? [];
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl pb-24">
        <header className="mb-10 flex items-start gap-5">
          <MarkCard className="hidden h-16 w-16 shrink-0 text-ink-300 sm:block" />
          <div>
            <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
              The Archive
            </h1>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-700">
              Projects that stopped, and why. Nothing here is wasted — every one can be picked
              up, and whoever continues it inherits the record rather than starting from zero.
            </p>
          </div>
        </header>

        {isPending ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : archives.length === 0 ? (
          <EmptyState
            mark={MarkCard}
            title="Nothing archived yet"
            description="When a project stops, its team writes down what happened. Those postmortems land here so the next team does not repeat them."
            secondary={{ label: "See what is being built", href: "/feed" }}
          />
        ) : (
          <ul className="space-y-5">
            {archives.map((a, i) => {
              const outcome = OUTCOME[a.outcome] ?? OUTCOME.PAUSED!;
              const revived = a.revivedBy.length > 0;

              return (
                <motion.li
                  key={a._id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.06 }}
                >
                  <Card variant="spotlight" className="p-6">
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge variant={outcome.variant}>{outcome.label}</Badge>
                      {a.track && (
                        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">
                          {a.track}
                        </span>
                      )}
                      {a.verifiedEvidenceCount > 0 && (
                        <span className="ml-auto flex items-center gap-1.5 text-[13px] font-medium text-stamp-verified">
                          <ShieldCheck className="h-4 w-4" />
                          {a.verifiedEvidenceCount} verified{" "}
                          {a.verifiedEvidenceCount === 1 ? "piece" : "pieces"} survived
                        </span>
                      )}
                    </div>

                    <h2 className="font-display text-xl text-ink-900">{a.title}</h2>

                    <p className="mt-2 text-[15px] leading-relaxed text-ink-700">{a.problem}</p>

                    {a.lessons && (
                      <div className="mt-4 border-l-2 border-rule pl-4">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                          What happened
                        </p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-700">
                          {a.lessons}
                        </p>
                      </div>
                    )}

                    {revived && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-paper-1 p-3">
                        <MarkHandoff className="h-6 w-6 shrink-0 text-stamp-verified" />
                        <span className="text-[13px] text-ink-700">Picked up as</span>
                        {a.revivedBy.map((r) => (
                          <Link
                            key={r.id}
                            href={`/ideas/${r.slug}`}
                            className="text-[13px] font-medium text-ink-900 underline decoration-rule underline-offset-4 hover:decoration-ink-900"
                          >
                            {r.title}
                          </Link>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
                      <Avatar name={a.author.name} src={a.author.avatarUrl} size="sm" />
                      <span className="text-[13px] text-ink-700">{a.author.name}</span>
                      {a.archivedAt && (
                        <span className="text-[13px] text-ink-500">
                          archived{" "}
                          {formatDistanceToNowStrict(new Date(a.archivedAt), { addSuffix: true })}
                        </span>
                      )}

                      {/* The point of the page. A postmortem nobody can act on
                          is a graveyard. */}
                      <Link
                        href={`/ideas/new?revive=${a._id}`}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-ink-900 bg-ink-900 px-3 py-2 text-sm font-medium text-paper-0 transition-opacity hover:opacity-90"
                      >
                        <Sprout className="h-4 w-4" />
                        {revived ? "Pick it up again" : "Pick this up"}
                      </Link>

                      <Link
                        href={`/ideas/${a.slug}`}
                        className="inline-flex items-center gap-1 text-sm text-ink-700 hover:text-ink-900"
                      >
                        Read it
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </Card>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
