"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SkeletonCard } from "@/components/ui/skeleton";
import { getPusherClient } from "@/lib/pusher-client";
import { CORE_TRACKS, STATUS_COLORS } from "@/types";
import type { IdeaStatus, RankTier } from "@/types";
import { Flame, Search, TrendingUp, Clock, Activity, Plus, Star, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs } from "@/components/ui/tabs";
import { FeedItemCard, type FeedItem } from "@/components/feed/feed-item";
import { FEED_KINDS, kindStyle } from "@/lib/feed/accent";
import { CampusPulse } from "@/components/feed/campus-pulse";
import { PostComposer } from "@/components/feed/post-composer";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { MarkNotice } from "@/components/marks";

interface IdeaData {
  _id: string;
  title: string;
  slug: string;
  problem: string;
  solution: string;
  track: string;
  tags: string[];
  status: IdeaStatus;
  healthScore: number;
  owner: { _id: string; name: string; username: string; rankTier: RankTier; avatarUrl?: string };
  collaborators: { _id: string; name: string; avatarUrl?: string }[];
  skillsNeeded: string[];
  upvotes: number;
  views: number;
  isFeatured: boolean;
}

export default function FeedPage() {
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalIdeas: 0, activeBuilds: 0, shipped: 0 });
  const [search, setSearch] = useState("");
  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "trending" | "health">("newest");
  const [view, setView] = useState<"for-you" | "ideas">("for-you");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // The ranked mixed feed. Ordering lives in src/lib/feed/rank.ts, which is a
  // pure function so what a student sees first can be tested and explained.
  const { data: forYou = [], isPending: forYouLoading } = useQuery<FeedItem[]>({
    queryKey: ["feed"],
    queryFn: async () => {
      const res = await fetch("/api/feed");
      if (!res.ok) throw new Error("Failed to load your feed");
      return (await res.json()).data ?? [];
    },
  });

  // Upvoting from the card. Optimistic, because the round trip is longer than
  // the moment the tap should feel like it landed — and rolled back on failure
  // so a refused vote (your own project, rate limited) does not leave a lie on
  // screen.
  const feedUpvote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ideas/${id}/upvote`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not record your vote");
      return body.data as { voted: boolean; upvotes: number };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["feed"] });
      const previous = queryClient.getQueryData<FeedItem[]>(["feed"]);
      queryClient.setQueryData<FeedItem[]>(["feed"], (old) =>
        (old ?? []).map((entry) =>
          entry._id === id && entry.type === "project"
            ? {
                ...entry,
                viewerHasUpvoted: !entry.viewerHasUpvoted,
                upvotes: (entry.upvotes ?? 0) + (entry.viewerHasUpvoted ? -1 : 1),
              }
            : entry
        )
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(["feed"], context.previous);
      toast.error("Could not record your vote", errorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => { if (d.data) setStats(d.data); }).catch(() => {});
  }, []);

  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("ideas-channel");
    channel.bind("upvote-update", (data: { ideaId: string, upvotes: number }) => {
      setIdeas(prev => prev.map(i => i._id === data.ideaId ? { ...i, upvotes: data.upvotes } : i));
      queryClient.setQueryData<FeedItem[]>(["feed"], (old) => {
        if (!old) return old;
        return old.map(entry => 
          entry._id === data.ideaId && entry.type === "project" 
            ? { ...entry, upvotes: data.upvotes } 
            : entry
        );
      });
    });

    return () => {
      pusher.unsubscribe("ideas-channel");
    };
  }, [queryClient]);

  useEffect(() => {
    const fetchIdeas = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (activeTrack) params.append("track", activeTrack);
        if (activeStatus) params.append("status", activeStatus);
        params.append("sort", sortBy);

        const res = await fetch(`/api/ideas?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          const data = result.data ?? result;
          const filtered = search
            ? data.filter((i: IdeaData) =>
                i.title.toLowerCase().includes(search.toLowerCase()) ||
                i.problem.toLowerCase().includes(search.toLowerCase())
              )
            : data;
          setIdeas(filtered);
        }
      } catch {
        // Keep UI resilient
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchIdeas, 300);
    return () => clearTimeout(debounce);
  }, [search, activeTrack, activeStatus, sortBy]);

  const handleUpvote = async (e: React.MouseEvent, ideaId: string) => {
    e.preventDefault();
    setIdeas(ideas.map(i => i._id === ideaId ? { ...i, upvotes: i.upvotes + 1 } : i));
    try {
      await fetch(`/api/ideas/${ideaId}/upvote`, { method: "POST" });
    } catch {
      setIdeas(ideas.map(i => i._id === ideaId ? { ...i, upvotes: i.upvotes - 1 } : i));
    }
  };

  // An empty filter set means "everything" rather than "nothing" — a filter
  // row that can hide the whole feed by default is a trap.
  const shownFeed = kinds.size === 0 ? forYou : forYou.filter((e) => kinds.has(e.type));

  const getTrackLabel = (slug: string) => CORE_TRACKS.find(t => t.slug === slug)?.label ?? slug;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-rule">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary font-display">Feed</h1>
            <p className="text-text-secondary mt-1">What your department is saying, running, building and asking for.</p>
          </div>
          <Link href="/ideas/new">
            <Button variant="gradient">
              <Plus className="mr-2 h-4 w-4" /> New Idea
            </Button>
          </Link>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Ideas", value: stats.totalIdeas, color: "text-stamp-verified" },
            { label: "Active Builds", value: stats.activeBuilds, color: "text-[#F2B24B]" },
            { label: "Shipped", value: stats.shipped, color: "text-[#2EA86A]" },
          ].map(kpi => (
            <div key={kpi.label} className="p-4 rounded-[var(--radius-md)] bg-paper-1/60 border border-rule text-center">
              <div className={`text-2xl font-bold font-display ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-text-muted font-medium uppercase tracking-wider mt-1">{kpi.label}</div>
            </div>
          ))}
        </div>

        <Tabs
          activeTab={view}
          onChange={(id) => setView(id as "for-you" | "ideas")}
          tabs={[
            { id: "for-you", label: "For you" },
            { id: "ideas", label: "Ideas" },
          ]}
        />

        {view === "for-you" ? (
          forYouLoading ? (
            <div className="grid grid-cols-1 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : forYou.length === 0 ? (
            <EmptyState mark={MarkNotice}
              title="Nothing here yet"
              description="Posts, events, projects and bounties from your department will appear here."
            />
          ) : (
            <>
              <PostComposer />

              <CampusPulse />

              {/* Filter by kind. The same four colours as the cards, so the
                  chip and the thing it filters are visibly the same object. */}
              <div className="flex flex-wrap gap-2">
                {FEED_KINDS.map((kind) => {
                  const style = kindStyle(kind);
                  const on = kinds.has(kind);
                  const count = forYou.filter((e) => e.type === kind).length;
                  if (count === 0) return null;

                  return (
                    <button
                      key={kind}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setKinds((prev) => {
                          const next = new Set(prev);
                          if (next.has(kind)) next.delete(kind);
                          else next.add(kind);
                          return next;
                        })
                      }
                      className="cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors"
                      style={
                        on
                          ? { background: style.ink, borderColor: style.ink, color: "#FAF7F2" }
                          : { background: style.wash, borderColor: style.edge, color: style.ink }
                      }
                    >
                      {style.label} {count}
                    </button>
                  );
                })}
                {kinds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setKinds(new Set())}
                    className="cursor-pointer rounded-full border border-rule px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-700 transition-colors hover:text-ink-900"
                  >
                    Show all
                  </button>
                )}
              </div>

            <div className="grid grid-cols-1 gap-4">
              {shownFeed.map((entry, index) => (
                <motion.div
                  key={`${entry.type}-${entry._id}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index, 8) * 0.04 }}
                >
                  <FeedItemCard
                    item={entry}
                    busy={feedUpvote.isPending}
                    onUpvote={(id) => feedUpvote.mutate(id)}
                  />
                </motion.div>
              ))}
            </div>
            </>
          )
        ) : (
        <>
        {/* Search & Sort */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              icon={<Search className="h-4 w-4" />}
              placeholder="Search ideas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-paper-1/80 border border-rule p-1 rounded-lg">
            {([
              { key: "newest", label: "Latest", icon: Clock },
              { key: "trending", label: "Trending", icon: TrendingUp },
              { key: "health", label: "Health", icon: Activity },
            ] as const).map(s => (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${sortBy === s.key ? "bg-paper-2 text-text-primary border border-ink-300" : "text-text-muted hover:text-text-secondary"}`}
              >
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Track Filters */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeTrack === null ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setActiveTrack(null)}
          >
            All Tracks
          </Badge>
          {CORE_TRACKS.map(t => (
            <Badge
              key={t.slug}
              variant={activeTrack === t.slug ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setActiveTrack(t.slug)}
            >
              {t.label}
            </Badge>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={activeStatus === null ? "default" : "outline"} className="cursor-pointer" onClick={() => setActiveStatus(null)}>All</Badge>
          {(["discovery", "building", "shipped"] as IdeaStatus[]).map(s => (
            <Badge key={s} variant={activeStatus === s ? STATUS_COLORS[s] as "info" | "warning" | "success" : "outline"} className="cursor-pointer capitalize" onClick={() => setActiveStatus(s)}>
              {s}
            </Badge>
          ))}
        </div>

        {/* Idea Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : ideas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AnimatePresence>
              {ideas.map((idea, index) => (
                <motion.div
                  key={idea._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/ideas/${idea._id}`}>
                    <Card variant="spotlight" className="h-full flex flex-col p-6 group hover:border-ink-300 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-2 items-center flex-wrap">
                          <Badge variant={STATUS_COLORS[idea.status] as "info" | "warning" | "success" | "secondary" | "danger"} className="capitalize">
                            {idea.status}
                          </Badge>
                          {idea.isFeatured && (
                            <Badge variant="gold" className="gap-1">
                              <Star className="h-3 w-3" /> Featured
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted font-mono">{getTrackLabel(idea.track)}</span>
                      </div>

                      <h3 className="text-lg font-bold text-text-primary leading-tight mb-2 group-hover:text-stamp-verified transition-colors line-clamp-2 font-display">
                        {idea.title}
                      </h3>

                      <p className="text-text-secondary text-sm line-clamp-2 mb-4 flex-1 leading-relaxed">
                        {idea.problem}
                      </p>

                      {/* Health & Skills */}
                      <div className="mb-4 space-y-3">
                        <ProgressBar value={idea.healthScore} showLabel />
                        <div className="flex flex-wrap gap-1.5">
                          {idea.skillsNeeded.slice(0, 4).map(skill => (
                            <span key={skill} className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-paper-2 text-text-muted border border-rule">
                              {skill}
                            </span>
                          ))}
                          {idea.skillsNeeded.length > 4 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold text-text-muted">+{idea.skillsNeeded.length - 4}</span>
                          )}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-rule mt-auto">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={idea.owner.name} tier={idea.owner.rankTier} size="sm" />
                          <div>
                            <span className="text-xs font-bold text-text-primary block leading-none">{idea.owner.name}</span>
                            <span className="text-[10px] text-text-muted">{idea.owner.rankTier}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleUpvote(e, idea._id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-paper-2 hover:bg-ink-900/10 border border-rule hover:border-stamp-verified/30 text-text-muted hover:text-stamp-verified transition-all cursor-pointer"
                          >
                            <Flame className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">{idea.upvotes}</span>
                          </button>
                          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-paper-2 border border-rule text-text-muted">
                            <Eye className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">{idea.views}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState mark={MarkNotice}
            title="No ideas found"
            description={search ? "Try adjusting your search or filters." : "Be the first to post an idea!"}
            action={!search ? { label: "New Idea", href: "/ideas/new" } : undefined}
          />
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}
