"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import {
  MarkBounty,
  MarkCalendar,
  MarkHandoff,
  MarkPost,
  MarkStamp,
} from "@/components/marks";

/**
 * Notifications.
 *
 * The endpoint has always supported marking one read and marking all read.
 * Nothing in the product ever called either, so a notification could be
 * created but never cleared — the count only ever went up, which is the
 * fastest way to teach someone to ignore a number.
 *
 * Each kind carries its mark, so the list is scannable by shape rather than
 * by reading every line. Verification is the one drawn in stamp green,
 * because that is the event the whole product exists to produce.
 */

interface Notification {
  _id: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  isRead: boolean;
  createdAt: string;
}

const KIND: Record<
  string,
  { Mark: React.ComponentType<{ className?: string }>; tone: string }
> = {
  evidence_verified: { Mark: MarkStamp, tone: "text-stamp-verified" },
  evidence_rejected: { Mark: MarkStamp, tone: "text-stamp-rejected" },
  join_request: { Mark: MarkHandoff, tone: "text-ink-500" },
  join_decision: { Mark: MarkHandoff, tone: "text-stamp-verified" },
  bounty_awarded: { Mark: MarkBounty, tone: "text-ink-900" },
  event_seat_confirmed: { Mark: MarkCalendar, tone: "text-ink-900" },
  event_waitlist_promoted: { Mark: MarkCalendar, tone: "text-stamp-verified" },
  review_assigned: { Mark: MarkStamp, tone: "text-ink-500" },
};

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery<{ data: Notification[]; meta: { unreadCount: number } }>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Could not load notifications");
      return res.json();
    },
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.meta?.unreadCount ?? 0;

  const markRead = useMutation({
    mutationFn: async (payload: { id?: string; all?: boolean }) => {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update");
      return body.data;
    },
    // Marking read must feel instant: it is the cheapest possible interaction
    // and a spinner on it is worse than the stale state it replaces.
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<{
        data: Notification[];
        meta: { unreadCount: number };
      }>(["notifications"]);

      queryClient.setQueryData(["notifications"], (old: typeof previous) => {
        if (!old) return old;
        const next = old.data.map((n) =>
          payload.all || n._id === payload.id ? { ...n, isRead: true } : n
        );
        return { data: next, meta: { unreadCount: next.filter((n) => !n.isRead).length } };
      });

      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(["notifications"], context.previous);
      toast.error("Could not update", errorMessage(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const shown = unreadOnly ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-24">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-5">
            <MarkPost className="hidden h-14 w-14 shrink-0 text-ink-300 sm:block" />
            <div>
              <h1 className="font-display text-3xl tracking-[-0.02em] text-ink-900 md:text-4xl">
                Notifications
              </h1>
              <p className="mt-2 text-[15px] text-ink-700">
                {unreadCount > 0
                  ? `${unreadCount} you have not read`
                  : "You are up to date."}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markRead.mutate({ all: true })}
              className="cursor-pointer rounded-[var(--radius-md)] border border-rule px-3 py-2 text-sm text-ink-700 transition-colors hover:border-ink-300 hover:text-ink-900"
            >
              Mark all read
            </button>
          )}
        </header>

        {notifications.length > 0 && (
          <div className="mb-5 flex gap-2">
            {[
              { id: "all", label: `All (${notifications.length})`, on: !unreadOnly },
              { id: "unread", label: `Unread (${unreadCount})`, on: unreadOnly },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.on}
                onClick={() => setUnreadOnly(t.id === "unread")}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  t.on
                    ? "border-ink-900 bg-ink-900 text-paper-0"
                    : "border-rule text-ink-700 hover:border-ink-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            mark={MarkPost}
            title={unreadOnly ? "Nothing unread" : "Nothing yet"}
            description={
              unreadOnly
                ? "You have read everything here."
                : "When someone verifies your work, answers a request, or gives you a seat, it lands here."
            }
            secondary={{ label: "See what is happening", href: "/feed" }}
          />
        ) : (
          <ul className="divide-y divide-rule overflow-hidden rounded-[var(--radius-lg)] border border-rule">
            {shown.map((n, i) => {
              const kind = KIND[n.type] ?? { Mark: MarkPost, tone: "text-ink-500" };
              const Mark = kind.Mark;

              const inner = (
                <>
                  <Mark className={`h-8 w-8 shrink-0 ${kind.tone}`} />

                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[15px] leading-snug ${
                        n.isRead ? "text-ink-700" : "font-medium text-ink-900"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-700">{n.body}</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500">
                      {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {!n.isRead && (
                    <span
                      aria-label="Unread"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stamp-verified"
                    />
                  )}
                  {n.linkUrl && (
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-ink-300" aria-hidden />
                  )}
                </>
              );

              const className = `flex w-full items-start gap-4 p-4 text-left transition-colors ${
                n.isRead ? "bg-paper-0" : "bg-paper-1/40"
              } hover:bg-paper-1`;

              return (
                <motion.li
                  key={n._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i, 10) * 0.03 }}
                >
                  {/* Opening it is the same gesture as reading it. Making a
                      student click a separate "mark read" control is how an
                      unread count becomes permanent. */}
                  {n.linkUrl ? (
                    <Link
                      href={n.linkUrl}
                      className={className}
                      onClick={() => {
                        if (!n.isRead) markRead.mutate({ id: n._id });
                      }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={className}
                      onClick={() => {
                        if (!n.isRead) markRead.mutate({ id: n._id });
                      }}
                    >
                      {inner}
                    </button>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
