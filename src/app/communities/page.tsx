"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { communityAccent, kindAccent } from "@/lib/communities/palette";
import { MarkRoom } from "@/components/marks";

interface CommunityRow {
  _id: string;
  slug: string;
  name: string;
  description: string;
  kind: "department" | "batch" | "project" | "event" | "interest";
  visibility: string;
  isSystemManaged: boolean;
  batchYear?: number;
  project?: { id: string; slug: string; title: string };
  memberCount: number;
  messageCount: number;
  viewer: {
    isMember: boolean;
    /** A request is in, but not yet answered. */
    awaitingApproval: boolean;
    role: string | null;
    lastReadAt: string | null;
  };
  pendingRequests: number;
}

/**
 * Communities index.
 *
 * Grouped by kind rather than shown as one flat list, because the kinds mean
 * different things: a student belongs to their batch and project rooms
 * automatically, and chooses interest rooms. Mixing them would suggest all five
 * work the same way.
 */
const GROUPS = [
  { kind: "department", title: "Department", blurb: "Everyone. Announcements and anything that fits nowhere else." },
  { kind: "batch", title: "Batches", blurb: "Your cohort, and every year above you." },
  { kind: "project", title: "Project rooms", blurb: "Private to the team building it." },
  { kind: "interest", title: "Interests", blurb: "Student-run. Join what you like, leave what you do not." },
  { kind: "event", title: "Events", blurb: "Coordination while an event runs. Archived afterwards." },
] as const;

export default function CommunitiesPage() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: communities = [], isPending } = useQuery<CommunityRow[]>({
    queryKey: ["communities"],
    queryFn: async () => {
      const res = await fetch("/api/communities");
      if (!res.ok) throw new Error("Could not load communities");
      return (await res.json()).data ?? [];
    } });

  const grouped = useMemo(() => {
    const map = new Map<string, CommunityRow[]>();
    for (const c of communities) {
      const list = map.get(c.kind) ?? [];
      list.push(c);
      map.set(c.kind, list);
    }
    return map;
  }, [communities]);

  const join = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/communities/${slug}/membership`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not join");
      return body.data;
    },
    onSuccess: (d) => {
      if (d.pending) {
        toast.info(
          "Request sent",
          `A moderator of ${d.community} will decide. You will be told either way.`
        );
      } else {
        toast.success("Joined", `You can post in ${d.community} now.`);
      }
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (e) => toast.error("Could not join", errorMessage(e)) });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create");
      return body.data;
    },
    onSuccess: () => {
      toast.success("Community created", "You are its owner and first member.");
      setCreating(false);
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (e) => toast.error("Could not create", errorMessage(e)) });

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-24">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-ink-900 tracking-[-0.02em]">
              Communities
            </h1>
            <p className="mt-2 text-text-secondary max-w-xl">
              Every conversation here is in a room with a moderator. There are no direct messages,
              on purpose.
            </p>
          </div>

          <Button
            variant={creating ? "ghost" : "primary"}
            className="min-h-[44px]"
            onClick={() => setCreating((v) => !v)}
          >
            {creating ? "Cancel" : (<><Plus className="h-4 w-4 mr-1" aria-hidden /> New community</>)}
          </Button>
        </header>

        {creating && (
          <Card className="p-5 mb-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="cname" className="block text-sm font-medium text-ink-900 mb-1">
                  Name
                </label>
                <input
                  id="cname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={3}
                  maxLength={60}
                  className="w-full min-h-[44px] rounded-[var(--r-md)] border border-rule bg-paper-0 px-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:ring-offset-2"
                  placeholder="Competitive Programming"
                />
              </div>

              <div>
                <label htmlFor="cdesc" className="block text-sm font-medium text-ink-900 mb-1">
                  What is it for?
                </label>
                <textarea
                  id="cdesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={20}
                  maxLength={400}
                  rows={3}
                  className="w-full rounded-[var(--r-md)] border border-rule bg-paper-0 p-3 text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:ring-offset-2"
                  placeholder="Contest post-mortems, practice sets, and who is doing ICPC this year."
                />
                <p className="mt-1 text-xs text-text-muted">At least 20 characters.</p>
              </div>

              <Button
                type="submit"
                loading={create.isPending}
                disabled={name.trim().length < 3 || description.trim().length < 20}
                className="min-h-[44px]"
              >
                Create
              </Button>
            </form>
          </Card>
        )}

        {isPending ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : communities.length === 0 ? (
          <EmptyState mark={MarkRoom}
            title="No communities yet"
            description="Start one for something you are working on, and invite the people who care about it."
          />
        ) : (
          <div className="space-y-10">
            {GROUPS.map((group) => {
              const rows = grouped.get(group.kind) ?? [];
              if (rows.length === 0) return null;

              return (
                <section key={group.kind}>
                  <div className="mb-3">
                    <h2
                      className="font-mono text-[11px] uppercase tracking-[0.14em] inline-flex items-center gap-2"
                      style={{ color: kindAccent(group.kind).ink }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: kindAccent(group.kind).ink }}
                        aria-hidden
                      />
                      {group.title}
                    </h2>
                    <p className="mt-1 text-sm text-text-muted">{group.blurb}</p>
                  </div>

                  <ul className="divide-y divide-rule border-y border-rule">
                    {rows.map((c) => {
                      const accent = communityAccent(c.slug);
                      return (
                      <li key={c._id}>
                        <div className="flex items-center gap-4 py-3.5 px-3 -mx-3 rounded-[var(--r-md)] hover:bg-paper-1/70 transition-colors">
                          <Link
                            href={`/communities/${c.slug}`}
                            className="flex-1 min-w-0 group flex items-start gap-3"
                          >
                            {/* Identity colour, same one the room itself uses,
                                so a community is recognisable before it is read. */}
                            <span
                              className="mt-0.5 w-9 h-9 shrink-0 rounded-[var(--r-md)] grid place-items-center font-display text-sm"
                              style={{
                                backgroundColor: accent.wash,
                                color: accent.ink,
                                boxShadow: `inset 0 0 0 1px ${accent.edge}` }}
                              aria-hidden
                            >
                              {c.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-ink-900 font-medium group-hover:underline underline-offset-4">
                                {c.name}
                              </span>
                              {c.visibility === "private" && (
                                <Badge variant="outline">
                                  <Lock className="h-3 w-3" aria-hidden /> Private
                                </Badge>
                              )}
                              {c.viewer.isMember && c.viewer.role !== "member" && (
                                <Badge variant="info">{c.viewer.role}</Badge>
                              )}
                            </span>
                            <span className="mt-0.5 block text-sm text-text-secondary line-clamp-1">
                              {c.description}
                            </span>
                            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted tabular-nums">
                              <Users className="inline h-3 w-3 mr-1" aria-hidden />
                              {c.memberCount} · {c.messageCount} messages
                            </span>
                            </span>
                          </Link>

                          {/* System rooms have no join button: membership follows
                              the batch, project or event they belong to. */}
                          {!c.isSystemManaged &&
                            !c.viewer.isMember &&
                            (c.viewer.awaitingApproval ? (
                              // Asking is not joining. Saying "Join" here would
                              // read as the request having been lost.
                              <span className="min-h-[44px] shrink-0 self-center rounded-[var(--radius-md)] border border-rule px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                                Requested
                              </span>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                className="min-h-[44px] shrink-0"
                                loading={join.isPending && join.variables === c.slug}
                                onClick={() => join.mutate(c.slug)}
                              >
                                {c.visibility === "request_to_join" ? "Ask to join" : "Join"}
                              </Button>
                            ))}

                          {/* Moderators see there is something waiting without
                              opening every room. */}
                          {c.pendingRequests > 0 &&
                            (c.viewer.role === "owner" || c.viewer.role === "moderator") && (
                              <Link
                                href={`/communities/${c.slug}`}
                                className="min-h-[44px] shrink-0 self-center rounded-[var(--radius-md)] border border-stamp-pending/40 bg-stamp-pending/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-stamp-pending"
                              >
                                {c.pendingRequests} waiting
                              </Link>
                            )}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
