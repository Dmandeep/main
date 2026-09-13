"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict, isPast } from "date-fns";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkBounty } from "@/components/marks";

/**
 * Bounties.
 *
 * Three things a student needs to know at a glance, and none of them were on
 * the card before: whether they can claim it, whether they already have, and
 * whether there is a slot left. The previous version showed a hardcoded
 * "individual" participation mode instead — a field the API invented and that
 * meant nothing — and read `postedBy.rankTier`, which the API has never
 * returned, so every avatar rendered untiered.
 *
 * Reserved bounties stay visible to everyone. Hiding them would be tidier and
 * worse: a second-year seeing "reserved for people with no verified work yet"
 * is the clearest possible statement of how the on-ramp works.
 */

interface BountyData {
  _id: string;
  title: string;
  description: string;
  kind: string;
  track?: string;
  rewardPoints: number;
  reservedForNewcomers?: boolean;
  claimable?: boolean;
  claimsLeft: number;
  viewerSubmission: { status: string; submittedAt: string } | null;
  deadlineAt: string | null;
  status: string;
  postedBy: { name: string; username: string; avatarUrl?: string };
}

const KIND_VARIANT: Record<string, "default" | "info" | "cyan" | "gold" | "ember" | "secondary"> = {
  build: "default",
  research: "info",
  design: "cyan",
  mentor: "gold",
  judge: "ember",
};

function closing(date: string | null): string {
  if (!date) return "no deadline";
  const d = new Date(date);
  if (isPast(d)) return "closed";
  return `closes in ${formatDistanceToNowStrict(d)}`;
}

export default function BountiesPage() {
  const [tab, setTab] = useState("open");

  const { data: bounties = [], isPending } = useQuery<BountyData[]>({
    queryKey: ["bounties"],
    queryFn: async () => {
      const res = await fetch("/api/bounties");
      if (!res.ok) throw new Error("Failed to load bounties");
      return (await res.json()).data ?? [];
    },
  });

  const mine = bounties.filter((b) => b.viewerSubmission);
  const reserved = bounties.filter((b) => b.reservedForNewcomers && b.claimable);
  const open = bounties.filter((b) => !b.viewerSubmission);

  const shown = tab === "mine" ? mine : tab === "reserved" ? reserved : open;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl pb-24">
        <header className="mb-8">
          <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
            Bounties
          </h1>
          <p className="mt-2 text-text-secondary">
            Specific pieces of work someone needs doing, with the points fixed before anyone
            claims one.
          </p>
        </header>

        <Tabs
          className="mb-6"
          activeTab={tab}
          onChange={setTab}
          tabs={[
            { id: "open", label: `Open (${open.length})` },
            ...(reserved.length > 0
              ? [{ id: "reserved", label: `Reserved for you (${reserved.length})` }]
              : []),
            { id: "mine", label: `Submitted (${mine.length})` },
          ]}
        />

        {isPending ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            mark={MarkBounty}
            title={
              tab === "mine"
                ? "You have not submitted to anything yet"
                : tab === "reserved"
                  ? "Nothing reserved right now"
                  : "No open bounties"
            }
            description={
              tab === "mine"
                ? "Claim a bounty and your submission shows up here with what it is waiting on."
                : tab === "reserved"
                  ? "Reserved bounties are the on-ramp for students with no verified work yet. New ones appear here."
                  : "Faculty and seniors post these when they need something specific done. Check back, or propose an idea of your own."
            }
            action={
              tab === "mine" ? { label: "Find a bounty", href: "/bounties" } : undefined
            }
            secondary={{ label: "Post an idea instead", href: "/ideas/new" }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((b, i) => (
              <motion.div
                key={b._id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.06 }}
              >
                <Link href={`/bounties/${b._id}`} className="group block h-full">
                  <Card
                    variant="spotlight"
                    className="flex h-full flex-col p-6 transition-colors group-hover:border-ink-300"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <Badge variant={KIND_VARIANT[b.kind] ?? "secondary"} className="capitalize">
                        {b.kind}
                      </Badge>

                      {b.viewerSubmission ? (
                        <Badge variant="success" className="gap-1">
                          <Check className="h-3 w-3" /> Submitted
                        </Badge>
                      ) : b.reservedForNewcomers ? (
                        <Badge variant={b.claimable ? "gold" : "secondary"}>
                          {b.claimable ? "Reserved for you" : "Newcomers only"}
                        </Badge>
                      ) : null}
                    </div>

                    <h2 className="mb-2 line-clamp-2 font-display text-lg text-ink-900">
                      {b.title}
                    </h2>
                    <p className="mb-4 line-clamp-3 flex-1 text-sm text-text-secondary">
                      {b.description}
                    </p>

                    <dl className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                      <dd className="text-ink-900">{b.rewardPoints} pts</dd>
                      <dd>{closing(b.deadlineAt)}</dd>
                      {/* A bounty at its claim limit is still worth reading, but
                          a student should not discover it is full after writing
                          a submission. */}
                      <dd className={b.claimsLeft === 0 ? "text-stamp-rejected" : ""}>
                        {b.claimsLeft === 0
                          ? "no slots left"
                          : `${b.claimsLeft} ${b.claimsLeft === 1 ? "slot" : "slots"}`}
                      </dd>
                    </dl>

                    <div className="flex items-center gap-2 border-t border-rule pt-3">
                      <Avatar name={b.postedBy.name} src={b.postedBy.avatarUrl} size="sm" />
                      <span className="flex-1 truncate text-xs text-text-muted">
                        {b.postedBy.name}
                      </span>
                      {b.claimable === false && !b.viewerSubmission && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-text-muted">
                          Not open to you
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
