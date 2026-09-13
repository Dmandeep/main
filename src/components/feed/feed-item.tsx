"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, MapPin, Pin, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MarkBounty, MarkCalendar, MarkBench, MarkNotice } from "@/components/marks";
import { kindStyle } from "@/lib/feed/accent";

/**
 * One item in the mixed feed.
 *
 * The first version put a 10px grey word above every card and nothing else, so
 * a conversation, a project, a seat and a job all arrived as the same beige
 * rectangle — you had to read a card to find out what it was, and a screen of
 * them was exhausting rather than scannable.
 *
 * Three things carry the kind now, so it survives losing any one of them: the
 * mark (shape), the accent (colour), and the word (text). Colour alone would
 * fail for a colour-blind reader; the mark alone would need learning; the word
 * alone was what we had.
 *
 * Each kind also gets the one action that makes sense for it, on the card. A
 * feed you can only read is a list of links.
 */

export interface FeedItem {
  _id: string;
  type: "post" | "event" | "project" | "bounty";
  _score?: number;

  body?: string;
  postKind?: string;
  author?: { name: string; username: string; avatarUrl?: string | null };
  community?: { slug: string; name: string } | null;
  project?: { slug: string; title: string } | null;
  pinned?: boolean;

  title?: string;
  description?: string | null;
  createdAt: string;

  eventKind?: string;
  status?: string;
  startsAt?: string | null;
  location?: string;
  capacity?: number | null;
  seatsHeld?: number;
  seatsLeft?: number | null;
  demandVotes?: number;

  slug?: string;
  tagline?: string | null;
  track?: string | null;
  verifiedEvidenceCount?: number;
  upvotes?: number;
  viewerHasUpvoted?: boolean;
  viewerIsOwner?: boolean;
  owner?: { name: string; username: string; avatarUrl?: string | null };

  bountyKind?: string;
  rewardPoints?: number;
  reservedForNewcomers?: boolean;
  reservedForViewer?: boolean;
  closesAt?: string | null;
  poster?: { name: string; username: string };
}

const MARKS = {
  post: MarkNotice,
  project: MarkBench,
  event: MarkCalendar,
  bounty: MarkBounty,
} as const;

function ago(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function FeedItemCard({
  item,
  onUpvote,
  busy,
}: {
  item: FeedItem;
  onUpvote?: (id: string) => void;
  busy?: boolean;
}) {
  const style = kindStyle(item.type);
  const Mark = MARKS[item.type] ?? MarkNotice;

  return (
    <motion.article
      // A small, quick lift. Enough to feel like the card responds; not enough
      // to make a scrolling page shimmer.
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-paper-0"
    >
      {/* The kind rail. Colour is identity here, never state — the stamp
          colours keep that job, and the accents are tested to stay clear of
          them. */}
      <div aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: style.ink }} />

      <div className="py-5 pl-6 pr-5">
        <header className="mb-3 flex items-center gap-2.5">
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: style.wash, color: style.ink }}
          >
            <Mark className="h-4 w-4" />
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em]">
              {style.label}
            </span>
          </span>

          {item.pinned && (
            <span title="Pinned by a moderator" className="text-ink-500">
              <Pin className="h-3.5 w-3.5" />
            </span>
          )}

          <time className="ml-auto font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500">
            {ago(item.createdAt)}
          </time>
        </header>

        {item.type === "post" && <PostBody item={item} />}
        {item.type === "event" && <EventBody item={item} />}
        {item.type === "project" && (
          <ProjectBody item={item} onUpvote={onUpvote} busy={busy} />
        )}
        {item.type === "bounty" && <BountyBody item={item} />}
      </div>
    </motion.article>
  );
}

function Title({ children, href }: { children: React.ReactNode; href?: string }) {
  const text = (
    <h3 className="font-display text-xl leading-snug text-ink-900 transition-colors group-hover:text-ink-700">
      {children}
    </h3>
  );
  return href ? (
    <Link href={href} className="block">
      {text}
    </Link>
  ) : (
    text
  );
}

/** Meta line. 11px minimum and ink-500, never ink-300 — this has to be read. */
function Meta({ children }: { children: React.ReactNode }) {
  return (
    <dl className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-ink-700">
      {children}
    </dl>
  );
}

function PostBody({ item }: { item: FeedItem }) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <Avatar name={item.author?.name ?? "?"} src={item.author?.avatarUrl ?? undefined} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{item.author?.name}</p>
          {item.community && (
            <Link
              href={`/communities/${item.community.slug}`}
              className="text-[13px] text-ink-500 hover:text-ink-900"
            >
              in {item.community.name}
            </Link>
          )}
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-700">
        {item.body}
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        {item.project && (
          <Link
            href={`/ideas/${item.project.slug}`}
            className="inline-flex items-center gap-1 text-sm text-ink-900 underline decoration-rule underline-offset-4 hover:decoration-ink-900"
          >
            {item.project.title}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
        {item.community && (
          <Link
            href={`/communities/${item.community.slug}`}
            className="inline-flex items-center gap-1 text-sm text-ink-700 hover:text-ink-900"
          >
            Open the room
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </>
  );
}

function EventBody({ item }: { item: FeedItem }) {
  const proposed = item.status === "proposed";
  const style = kindStyle("event");

  return (
    <>
      <Title href="/events">{item.title}</Title>
      {item.description && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ink-700">
          {item.description}
        </p>
      )}

      <Meta>
        {item.startsAt && (
          <dd className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-ink-500" />
            {ago(item.startsAt)}
          </dd>
        )}
        {item.location && (
          <dd className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-ink-500" />
            {item.location}
          </dd>
        )}
        <dd className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-ink-500" />
          {proposed
            ? `${item.demandVotes} ${item.demandVotes === 1 ? "vote" : "votes"}`
            : item.capacity == null
              ? `${item.seatsHeld} going`
              : item.seatsLeft === 0
                ? "full — waitlist open"
                : `${item.seatsLeft} of ${item.capacity} seats left`}
        </dd>
      </Meta>

      <Link
        href="/events"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: style.wash, color: style.ink }}
      >
        {proposed ? "Vote for this" : item.seatsLeft === 0 ? "Join the waitlist" : "Take a seat"}
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </>
  );
}

function ProjectBody({
  item,
  onUpvote,
  busy,
}: {
  item: FeedItem;
  onUpvote?: (id: string) => void;
  busy?: boolean;
}) {
  const verified = item.verifiedEvidenceCount ?? 0;
  const voted = item.viewerHasUpvoted ?? false;

  return (
    <>
      <Title href={`/ideas/${item.slug}`}>{item.title}</Title>
      {item.tagline && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ink-700">
          {item.tagline}
        </p>
      )}

      <Meta>
        {verified > 0 ? (
          <dd className="flex items-center gap-1.5 font-medium text-stamp-verified">
            <ShieldCheck className="h-4 w-4" />
            {verified} verified {verified === 1 ? "piece" : "pieces"}
          </dd>
        ) : (
          <dd className="text-ink-500">Nothing verified yet</dd>
        )}
        {item.owner && <dd className="text-ink-500">@{item.owner.username}</dd>}
      </Meta>

      {/* Upvoting your own project is refused by the handler, so the card does
          not offer it — an action that always errors is worse than none. */}
      {onUpvote && !item.viewerIsOwner && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onUpvote(item._id)}
          aria-pressed={voted}
          className={`mt-4 inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
            voted
              ? "border-ink-900 bg-ink-900 text-paper-0"
              : "border-rule text-ink-700 hover:border-ink-300 hover:text-ink-900"
          }`}
        >
          <motion.span
            key={String(voted)}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            ▲
          </motion.span>
          <span className="tabular-nums">{item.upvotes ?? 0}</span>
          <span className="sr-only">{voted ? "Remove your upvote" : "Upvote this project"}</span>
        </button>
      )}
    </>
  );
}

function BountyBody({ item }: { item: FeedItem }) {
  const style = kindStyle("bounty");

  return (
    <>
      <Title href={`/bounties/${item._id}`}>{item.title}</Title>
      {item.description && (
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-ink-700">
          {item.description}
        </p>
      )}

      <Meta>
        <dd className="font-medium text-ink-900">{item.rewardPoints} points</dd>
        {item.closesAt && <dd>closes {ago(item.closesAt)}</dd>}
        {/* Only shown where it is true for this viewer — the API decides that,
            so a reserved badge never advertises a door that is shut. */}
        {item.reservedForViewer && (
          <dd
            className="rounded-full px-2 py-0.5 text-[12px] font-medium"
            style={{ background: style.wash, color: style.ink }}
          >
            Reserved for you
          </dd>
        )}
      </Meta>

      <Link
        href={`/bounties/${item._id}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: style.wash, color: style.ink }}
      >
        See what it needs
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </>
  );
}
