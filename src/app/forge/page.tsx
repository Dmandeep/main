"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict, isPast } from "date-fns";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MarkBench,
  MarkBounty,
  MarkCalendar,
  MarkPlumb,
  MarkStamp,
} from "@/components/marks";

/**
 * The Forge — everything that is yours, in one place.
 *
 * This page used to be a second events list: it fetched `/api/workshops`
 * (which forwards to `/api/events`) and read fields that serialiser has never
 * returned — `host`, `durationMins`, `rsvpList`, `maxAttendees` — so it
 * rendered undefined in every slot. Once /events existed it was also a
 * duplicate destination.
 *
 * What was actually missing was the workspace: the screen that answers "what
 * am I in the middle of, and what is waiting on someone else". `/api/dashboard`
 * already computed most of that and had no consumer at all.
 *
 * The ordering is deliberate — what needs *you* first, then what you are
 * waiting on, then what you hold. A screen that opens with a trophy case
 * tells a student they are finished.
 */

interface NextTier {
  tier: string;
  at: number;
  remaining: number;
}

interface ForgeData {
  myIdeas: {
    _id: string;
    slug: string;
    title: string;
    status: string;
    verifiedEvidenceCount?: number;
  }[];
  stats: {
    ideasOwned: number;
    proofsVerified: number;
    proofsAwaitingReview: number;
    points: number;
    rank: number | null;
    rankTier: string;
    nextTier: NextTier | null;
  };
  claims: {
    _id: string;
    status: string;
    summary: string;
    submittedAt: string;
    awardedAt: string | null;
    bounty: {
      _id: string;
      title: string;
      rewardPoints: number;
      status: string;
      closesAt: string | null;
    };
  }[];
  seats: {
    _id: string;
    status: string;
    allocation: string | null;
    waitlistPosition: number | null;
    event: { _id: string; title: string; startsAt: string | null; location?: string };
  }[];
  evidence: {
    _id: string;
    title: string;
    state: string;
    createdAt: string;
    project: { slug: string; title: string } | null;
    lastDecision: { decision: string; rationale: string | null; at: string } | null;
  }[];
}

function when(iso: string | null): string {
  if (!iso) return "not scheduled";
  const d = new Date(iso);
  return `${isPast(d) ? "" : "in "}${formatDistanceToNowStrict(d, { addSuffix: isPast(d) })}`;
}

export default function ForgePage() {
  const { data, isPending } = useQuery<ForgeData>({
    queryKey: ["forge"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to load your work");
      return (await res.json()).data;
    },
  });

  if (isPending || !data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl pb-24">
          <Skeleton className="mb-8 h-28" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  const rejected = data.evidence.filter(
    (e) => e.state === "rejected" && e.lastDecision?.rationale
  );
  const pending = data.evidence.filter((e) =>
    ["submitted", "under_review", "machine_verified"].includes(e.state)
  );
  const openClaims = data.claims.filter((c) => c.status === "submitted");
  const heldSeats = data.seats;

  const nothingYet =
    data.myIdeas.length === 0 &&
    data.claims.length === 0 &&
    data.seats.length === 0 &&
    data.evidence.length === 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl pb-24">
        <header className="mb-8">
          <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
            The Forge
          </h1>
          <p className="mt-2 text-text-secondary">
            What you are in the middle of, and what is waiting on someone else.
          </p>
        </header>

        <StandingBar stats={data.stats} />

        {nothingYet ? (
          <EmptyState
            mark={MarkBench}
            title="Nothing on your bench yet"
            description="Post an idea, claim a starter bounty, or take a seat at something. Whatever you start shows up here with what it is waiting on."
            action={{ label: "Post an idea", href: "/ideas/new" }}
            secondary={{ label: "Browse bounties", href: "/bounties" }}
          />
        ) : (
          <div className="mt-10 space-y-12">
            {/* Needs you first. A rejection nobody reads is a rejection that
                never gets fixed. */}
            {rejected.length > 0 && (
              <Section
                mark={MarkStamp}
                title="Sent back to you"
                note="A reviewer said what would make these acceptable"
              >
                <ul className="space-y-3">
                  {rejected.map((e) => (
                    <li key={e._id}>
                      <Card className="border-stamp-rejected/30 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-display text-lg text-ink-900">{e.title}</p>
                            {e.project && (
                              <Link
                                href={`/ideas/${e.project.slug}`}
                                className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted hover:text-text-primary"
                              >
                                {e.project.title}
                              </Link>
                            )}
                          </div>
                          <Badge variant="danger">Needs work</Badge>
                        </div>
                        <p className="mt-3 border-l-2 border-rule pl-3 text-sm leading-relaxed text-ink-700">
                          {e.lastDecision?.rationale}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {pending.length > 0 && (
              <Section
                mark={MarkStamp}
                title="Waiting on a reviewer"
                note={`${pending.length} ${pending.length === 1 ? "piece" : "pieces"} in the queue`}
              >
                <ul className="divide-y divide-rule rounded-[var(--radius-lg)] border border-rule">
                  {pending.map((e) => (
                    <li key={e._id} className="flex items-center gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-900">{e.title}</p>
                        {e.project && (
                          <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                            {e.project.title}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                        {formatDistanceToNowStrict(new Date(e.createdAt), { addSuffix: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {openClaims.length > 0 && (
              <Section mark={MarkBounty} title="Bounties you have claimed" note="">
                <ul className="space-y-3">
                  {openClaims.map((c) => (
                    <li key={c._id}>
                      <Link href={`/bounties/${c.bounty._id}`} className="block">
                        <Card className="p-5 transition-colors hover:border-ink-300">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="font-display text-lg text-ink-900">{c.bounty.title}</p>
                            <span className="font-mono text-sm tabular-nums text-ink-900">
                              {c.bounty.rewardPoints} pts
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                            {c.summary}
                          </p>
                          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                            Submitted{" "}
                            {formatDistanceToNowStrict(new Date(c.submittedAt), {
                              addSuffix: true })}
                            {c.bounty.closesAt ? ` · closes ${when(c.bounty.closesAt)}` : ""}
                          </p>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {heldSeats.length > 0 && (
              <Section mark={MarkCalendar} title="Your seats" note="">
                <ul className="space-y-3">
                  {heldSeats.map((s) => (
                    <li key={s._id}>
                      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
                        <div className="min-w-0">
                          <p className="font-display text-lg text-ink-900">{s.event.title}</p>
                          <p className="mt-1 text-sm text-text-secondary">
                            {when(s.event.startsAt)}
                            {s.event.location ? ` · ${s.event.location}` : ""}
                          </p>
                        </div>
                        {s.status === "waitlisted" ? (
                          <Badge variant="secondary">Waitlist #{s.waitlistPosition}</Badge>
                        ) : s.allocation === "NEWCOMER_QUOTA" ? (
                          <Badge variant="gold">Reserved seat</Badge>
                        ) : (
                          <Badge variant="success">Seat held</Badge>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {data.myIdeas.length > 0 && (
              <Section mark={MarkBench} title="Projects you are on" note="">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {data.myIdeas.map((idea) => (
                    <li key={idea._id}>
                      <Link href={`/ideas/${idea.slug}`} className="block h-full">
                        <Card className="h-full p-5 transition-colors hover:border-ink-300">
                          <p className="font-display text-lg text-ink-900">{idea.title}</p>
                          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                            {idea.status}
                            {idea.verifiedEvidenceCount
                              ? ` · ${idea.verifiedEvidenceCount} verified`
                              : " · nothing verified yet"}
                          </p>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

/**
 * Standing, with the distance to the next tier.
 *
 * Progress is shown because it is real and derived — points come from an
 * append-only ledger and the threshold from the same table that decides the
 * tier. There is deliberately no streak, no daily goal and no decay timer:
 * the product's claim is that verified work counts, and a counter that falls
 * because you did not open the app would be rewarding attendance instead.
 */
function StandingBar({ stats }: { stats: ForgeData["stats"] }) {
  const next = stats.nextTier;
  const floor = next ? Math.max(next.at - 200, 0) : 0;
  const span = next ? next.at - floor : 1;
  const progress = next
    ? Math.min(Math.max((stats.points - floor) / span, 0), 1)
    : 1;

  return (
    <Card variant="glass" className="p-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <MarkPlumb className="h-10 w-10 text-ink-300" />
          <div>
            <p className="font-display text-4xl tabular-nums text-ink-900">{stats.points}</p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Points this season
            </p>
          </div>
        </div>

        <dl className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.1em]">
          <Figure label="Tier" value={stats.rankTier.toLowerCase()} />
          <Figure label="Rank" value={stats.rank ? `#${stats.rank}` : "unranked"} />
          <Figure label="Verified" value={stats.proofsVerified} />
          <Figure label="In review" value={stats.proofsAwaitingReview} />
        </dl>
      </div>

      {next && (
        <div className="mt-6">
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-2">
            <motion.div
              className="h-full rounded-full bg-stamp-verified"
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
            {next.remaining} points to {next.tier.toLowerCase()}
          </p>
        </div>
      )}
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-1 text-base tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}

function Section({
  mark: Mark,
  title,
  note,
  children }: {
  mark: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 flex items-center gap-3">
        <Mark className="h-7 w-7 shrink-0 text-ink-300" />
        <h2 className="font-display text-xl text-ink-900">{title}</h2>
        {note && (
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
            {note}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}
