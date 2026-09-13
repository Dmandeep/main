"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, Handshake, ShieldCheck, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MarkHandoff, MarkRoom, MarkStamp } from "@/components/marks";
import { kindStyle } from "@/lib/feed/accent";

/**
 * The campus pulse.
 *
 * Sits above the feed and answers what the feed cannot: who did something that
 * got signed off, who needs a person like you, and who just arrived.
 *
 * Every row here names a person. That is the point — a department that only
 * ever shows you aggregate counts feels like a database, and the thing that
 * makes a student open the app again is seeing someone they know got their
 * work verified, or that a team is short exactly what they can do.
 *
 * Nothing here is a streak or a daily goal. It is what happened.
 */

interface Pulse {
  verified: {
    _id: string;
    title: string;
    at: string;
    by: { name: string; username: string; avatarUrl?: string | null };
    project: { slug: string; title: string } | null;
  }[];
  needsYou: {
    _id: string;
    slug: string;
    title: string;
    tagline: string | null;
    matched: string[];
    teamSize: number;
    owner: { name: string; username: string; avatarUrl?: string | null };
  }[];
  newFaces: {
    _id: string;
    name: string;
    username: string;
    avatarUrl?: string;
    year?: number;
    joinedAt: string;
  }[];
  meta: { windowDays: number; viewerHasSkills: boolean };
}

export function CampusPulse() {
  const { data } = useQuery<Pulse>({
    queryKey: ["pulse"],
    queryFn: async () => {
      const res = await fetch("/api/pulse");
      if (!res.ok) throw new Error("Could not load the pulse");
      return (await res.json()).data;
    },
  });

  if (!data) return null;

  const hasAnything =
    data.verified.length > 0 || data.needsYou.length > 0 || data.newFaces.length > 0;
  if (!hasAnything) return null;

  const project = kindStyle("project");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Who needs you. First, because it is the only one you can act on. */}
      {data.needsYou.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-lg)] border p-5 lg:col-span-2"
          style={{ borderColor: project.edge, background: project.wash }}
        >
          <header className="mb-4 flex items-center gap-2.5">
            <Handshake className="h-5 w-5" style={{ color: project.ink }} />
            <h2 className="font-display text-lg" style={{ color: project.ink }}>
              Teams looking for what you do
            </h2>
          </header>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {data.needsYou.map((p) => (
              <li key={p._id}>
                <Link
                  href={`/ideas/${p.slug}`}
                  className="group flex h-full flex-col rounded-[var(--radius-md)] bg-paper-0 p-4 transition-colors hover:bg-paper-1"
                >
                  <p className="font-display text-base text-ink-900">{p.title}</p>
                  {p.tagline && (
                    <p className="mt-1 line-clamp-2 flex-1 text-[13px] text-ink-700">
                      {p.tagline}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.matched.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full px-2 py-0.5 text-[12px] font-medium"
                        style={{ background: project.wash, color: project.ink }}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 flex items-center gap-1 text-[13px] text-ink-500">
                    {p.teamSize} on the team
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Signed off lately. */}
      {data.verified.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[var(--radius-lg)] border border-rule bg-paper-0 p-5"
        >
          <header className="mb-4 flex items-center gap-2.5">
            <MarkStamp className="h-6 w-6 text-stamp-verified" />
            <h2 className="font-display text-lg text-ink-900">Signed off lately</h2>
          </header>

          <ul className="space-y-3">
            {data.verified.slice(0, 5).map((v) => (
              <li key={v._id} className="flex items-start gap-2.5">
                <Avatar name={v.by.name} src={v.by.avatarUrl ?? undefined} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug text-ink-900">
                    <Link href={`/profile/${v.by.username}`} className="hover:underline">
                      {v.by.name}
                    </Link>
                    <span className="text-ink-700"> — {v.title}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-stamp-verified" />
                    {v.project && (
                      <Link href={`/ideas/${v.project.slug}`} className="truncate hover:underline">
                        {v.project.title}
                      </Link>
                    )}
                    <span>· {formatDistanceToNowStrict(new Date(v.at), { addSuffix: true })}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Who just arrived. Not a leaderboard — the opposite of one. */}
      {data.newFaces.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[var(--radius-lg)] border border-rule bg-paper-0 p-5"
        >
          <header className="mb-2 flex items-center gap-2.5">
            <MarkRoom className="h-6 w-6 text-ink-300" />
            <h2 className="font-display text-lg text-ink-900">New here</h2>
          </header>
          <p className="mb-4 text-[13px] text-ink-500">
            Nothing verified yet. A first bounty or a place on a team is the usual way in.
          </p>

          <ul className="flex flex-wrap gap-2">
            {data.newFaces.map((p) => (
              <li key={p._id}>
                <Link
                  href={`/profile/${p.username}`}
                  className="flex items-center gap-2 rounded-full border border-rule bg-paper-1/60 py-1.5 pl-1.5 pr-3 transition-colors hover:border-ink-300"
                >
                  <Avatar name={p.name} src={p.avatarUrl} size="sm" />
                  <span className="text-[13px] text-ink-900">{p.name}</span>
                  {p.year && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500">
                      Y{p.year}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {/* Told, not hidden: an empty match list usually means an empty profile,
          and the student can fix that in one click. */}
      {data.needsYou.length === 0 && !data.meta.viewerHasSkills && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-4 rounded-[var(--radius-lg)] border border-rule bg-paper-1 p-5 lg:col-span-2"
        >
          <MarkHandoff className="h-10 w-10 shrink-0 text-ink-300" />
          <div>
            <p className="flex items-center gap-1.5 font-display text-base text-ink-900">
              <Sparkles className="h-4 w-4 text-ink-500" />
              Say what you can do
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-700">
              Teams here list the skills they are short of. Add yours and this space fills with
              the ones that need you.
            </p>
            <Link
              href="/profile/edit"
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-ink-900 underline decoration-rule underline-offset-4 hover:decoration-ink-900"
            >
              Add your skills
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.section>
      )}
    </div>
  );
}
