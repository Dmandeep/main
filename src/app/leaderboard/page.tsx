"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { MarkPlumb } from "@/components/marks";

/**
 * Standing.
 *
 * A ranked list of people is the single easiest thing to get wrong on a campus
 * product: done badly it tells twenty students they are losing. Three choices
 * keep it honest.
 *
 * Every row says what the points are *for* — verified work, not activity — so
 * the list reads as a record of what people did rather than a score.
 *
 * The viewer's own row is pinned and shown in full even when they are 24th,
 * because the useful question is "where am I and what moves me" and scrolling
 * to find yourself in last place is a bad way to answer it.
 *
 * Newcomers get their own view rather than being buried at the bottom of one
 * list. Somebody on 0 points is at the start of something, not at the end of
 * a ranking, and the seed of every collaboration on this platform is a senior
 * noticing one of them.
 */

interface Row {
  _id: string;
  rank: number;
  points: number;
  rankTier: string;
  proofsSubmitted: number;
  ideasShipped: number;
  user: { _id: string; name: string; username: string; avatarUrl?: string; rankTier: string };
}

const TIER_INK: Record<string, string> = {
  BRONZE: "#8C5A2E",
  SILVER: "#5E656F",
  GOLD: "#9A7B1E",
  PLATINUM: "#1C6E73",
  ELITE: "#5B4B9A",
};

export default function LeaderboardPage() {
  const [tab, setTab] = useState("standing");
  const { data: session } = useSession();
  const me = session?.user?.username;

  const { data: rows = [], isPending } = useQuery<Row[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/leaderboard?period=season");
      if (!res.ok) throw new Error("Could not load standing");
      return (await res.json()).data ?? [];
    },
  });

  const ranked = rows.filter((r) => r.points > 0);
  const starting = rows.filter((r) => r.points === 0);
  const mine = rows.find((r) => r.user.username === me);

  const shown = tab === "starting" ? starting : ranked;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-24">
        <header className="mb-8 flex items-start gap-5">
          <MarkPlumb className="hidden h-16 w-16 shrink-0 text-ink-300 sm:block" />
          <div>
            <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
              Standing
            </h1>
            <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-700">
              Every point here came from work a faculty member signed off. Nothing is awarded for
              posting, logging in, or being early.
            </p>
          </div>
        </header>

        {/* Your own row, pinned. */}
        {mine && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-wrap items-center gap-4 rounded-[var(--radius-lg)] border border-ink-900 bg-paper-1 p-5"
          >
            <span className="font-display text-2xl tabular-nums text-ink-900">
              {mine.points > 0 ? `#${mine.rank}` : "—"}
            </span>
            <Avatar name={mine.user.name} src={mine.user.avatarUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg text-ink-900">You</p>
              <p className="text-[13px] text-ink-700">
                {mine.proofsSubmitted} verified{" "}
                {mine.proofsSubmitted === 1 ? "piece" : "pieces"} of work
              </p>
            </div>
            <span className="font-display text-2xl tabular-nums text-ink-900">{mine.points}</span>
          </motion.div>
        )}

        <Tabs
          className="mb-6"
          activeTab={tab}
          onChange={setTab}
          tabs={[
            { id: "standing", label: `Standing (${ranked.length})` },
            { id: "starting", label: `Just starting (${starting.length})` },
          ]}
        />

        {isPending ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            mark={MarkPlumb}
            title={tab === "starting" ? "Everyone has something verified" : "Nothing verified yet"}
            description={
              tab === "starting"
                ? "Every member of this department has had at least one piece of work signed off."
                : "Standing moves when a faculty member signs off a piece of work. Attach evidence to a project to start."
            }
            secondary={{ label: "See what is being built", href: "/feed" }}
          />
        ) : tab === "starting" ? (
          <>
            <p className="mb-4 text-[15px] leading-relaxed text-ink-700">
              These people have not had anything verified yet. Most of them are looking for a first
              team — a reserved bounty or a place on a project is the usual way in.
            </p>
            <ul className="flex flex-wrap gap-2">
              {shown.map((r) => (
                <li key={r._id}>
                  <Link
                    href={`/profile/${r.user.username}`}
                    className="flex items-center gap-2 rounded-full border border-rule bg-paper-1/60 py-1.5 pl-1.5 pr-3.5 transition-colors hover:border-ink-300"
                  >
                    <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
                    <span className="text-[13px] text-ink-900">{r.user.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-[var(--radius-lg)] border border-rule">
            {shown.map((r, i) => {
              const isMe = r.user.username === me;
              return (
                <motion.li
                  key={r._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                  className={`flex items-center gap-4 p-4 transition-colors ${
                    isMe ? "bg-paper-1" : "bg-paper-0 hover:bg-paper-1/50"
                  }`}
                >
                  <span className="w-8 shrink-0 text-center font-mono text-sm tabular-nums text-ink-500">
                    {r.rank}
                  </span>

                  <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/profile/${r.user.username}`}
                      className="block truncate text-[15px] text-ink-900 hover:underline"
                    >
                      {r.user.name}
                    </Link>
                    {/* What the number is for, on every row. */}
                    <p className="flex items-center gap-1.5 text-[13px] text-ink-500">
                      <ShieldCheck className="h-3.5 w-3.5 text-stamp-verified" />
                      {r.proofsSubmitted} verified
                      {r.ideasShipped > 0 && ` · ${r.ideasShipped} shipped`}
                    </p>
                  </div>

                  <span
                    className="hidden font-mono text-[10px] uppercase tracking-[0.1em] sm:block"
                    style={{ color: TIER_INK[r.rankTier] ?? "#5E656F" }}
                  >
                    {r.rankTier.toLowerCase()}
                  </span>

                  <span className="w-14 shrink-0 text-right font-display text-lg tabular-nums text-ink-900">
                    {r.points}
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
