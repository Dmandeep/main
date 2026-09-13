"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { authorAccent, initialsOf } from "@/lib/communities/palette";

export interface Message {
  _id: string;
  body: string | null;
  removed: boolean;
  removedReason?: string;
  createdAt: string;
  editedAt: string | null;
  replyToId: string | null;
  author: { _id: string; name: string; username: string; avatarUrl?: string };
}

/** Consecutive messages from one person within this window collapse into a run. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function dayOf(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface Row {
  message: Message;
  day: string;
  showDay: boolean;
  /** False when this continues a run from the same author. */
  showAuthor: boolean;
}

/**
 * Derive day separators and message grouping in one pure pass.
 *
 * Grouping is the single biggest readability win in a chat log: repeating an
 * avatar and a name for every line of a five-message thought turns a
 * conversation into a list of receipts. Done here rather than in the render
 * loop because mutating during render is what the React Compiler refuses.
 */
export function buildRows(messages: Message[]): Row[] {
  let previousDay = "";
  let previousAuthor = "";
  let previousAt = 0;

  return messages.map((message) => {
    const day = dayOf(message.createdAt);
    const at = new Date(message.createdAt).getTime();

    const showDay = day !== previousDay;
    const continues =
      !showDay &&
      message.author._id === previousAuthor &&
      at - previousAt < GROUP_WINDOW_MS &&
      !message.removed;

    previousDay = day;
    previousAuthor = message.author._id;
    previousAt = at;

    return { message, day, showDay, showAuthor: !continues };
  });
}

export function MessageList({ messages }: { messages: Message[] }) {
  const rows = buildRows(messages);

  return (
    <>
      {rows.map(({ message: m, day, showDay, showAuthor }) => {
        const accent = authorAccent(m.author._id);

        return (
          <div key={m._id}>
            {showDay && (
              <div className="flex items-center gap-3 my-6">
                <span className="h-px flex-1 bg-rule" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500 px-2 py-1 rounded-full bg-paper-1 border border-rule">
                  {day}
                </span>
                <span className="h-px flex-1 bg-rule" />
              </div>
            )}

            <article
              className={[
                "group flex gap-3 px-3 -mx-3 rounded-[var(--r-md)] transition-colors",
                "hover:bg-paper-1/70",
                showAuthor ? "mt-3 py-1.5" : "py-0.5",
              ].join(" ")}
            >
              {/* Avatar only opens a run; a continuation keeps the column but
                  shows the timestamp on hover instead, the way chat apps do. */}
              <div className="w-9 shrink-0 flex justify-center">
                {showAuthor ? (
                  <span
                    className="w-9 h-9 rounded-full grid place-items-center text-[11px] font-semibold ring-1"
                    style={{
                      backgroundColor: accent.wash,
                      color: accent.ink,
                      // Tailwind cannot see a runtime colour, so the ring is inline.
                      boxShadow: `inset 0 0 0 1px ${accent.edge}`,
                    }}
                    aria-hidden
                  >
                    {initialsOf(m.author.name)}
                  </span>
                ) : (
                  <time
                    dateTime={m.createdAt}
                    className="mt-1 font-mono text-[9px] text-ink-300 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {timeOf(m.createdAt)}
                  </time>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {showAuthor && (
                  <p className="flex items-baseline gap-2 flex-wrap">
                    <Link
                      href={`/profile/${m.author.username}`}
                      className="text-sm font-semibold hover:underline underline-offset-4"
                      style={{ color: accent.ink }}
                    >
                      {m.author.name}
                    </Link>
                    <time
                      dateTime={m.createdAt}
                      className="font-mono text-[10px] text-ink-300 tabular-nums"
                    >
                      {timeOf(m.createdAt)}
                    </time>
                    {m.editedAt && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-300">
                        edited
                      </span>
                    )}
                  </p>
                )}

                {m.removed ? (
                  <p className="flex items-center gap-2 text-sm text-ink-300 italic py-0.5">
                    <ShieldOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Removed by a moderator — {m.removedReason}
                  </p>
                ) : (
                  <p className="text-[15px] leading-relaxed text-ink-700 whitespace-pre-wrap break-words">
                    {m.body}
                  </p>
                )}
              </div>
            </article>
          </div>
        );
      })}
    </>
  );
}
