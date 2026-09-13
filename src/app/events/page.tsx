"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast } from "date-fns";
import { CalendarDays, Check, ClipboardList, MapPin, ThumbsUp, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/ToastSystem";
import { canSessionRole } from "@/lib/authz/permissions";
import { errorMessage } from "@/lib/utils";
import { MarkCalendar } from "@/components/marks";

/**
 * Campus events.
 *
 * Two different things share this page because they are two stages of one
 * lifecycle: a PROPOSED event is demand being measured, and a SCHEDULED one is
 * a seat being allocated. Splitting them into separate destinations would hide
 * the thing that makes the system fair — that what gets scheduled is what
 * people actually asked for.
 *
 * Seats show their composition, not just a count. "12 left" tells a first-year
 * nothing about whether any of those seats are reachable by them; "4 of 10
 * reserved seats still open" does.
 */

interface ViewerRegistration {
  status: string;
  allocation: string | null;
  waitlistPosition: number | null;
}

interface EventData {
  _id: string;
  title: string;
  description: string | null;
  kind: string;
  track?: string;
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  location?: string;
  capacity: number | null;
  newcomerQuotaPercent: number;
  demandVotes: number;
  registered: number;
  seatsLeft: number | null;
  viewerHasVoted: boolean;
  viewerRegistration: ViewerRegistration | null;
}

const KIND_VARIANT: Record<string, "default" | "info" | "cyan" | "gold" | "ember" | "secondary"> = {
  workshop: "info",
  hackathon: "ember",
  talk: "cyan",
  showcase: "gold",
  contest: "default",
};

function when(event: EventData): string {
  if (!event.scheduledAt) return "Not scheduled";
  const start = new Date(event.scheduledAt);
  return format(start, "EEE d MMM, h:mma");
}

export default function EventsPage() {
  const [tab, setTab] = useState("scheduled");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const mayAllocate = canSessionRole(session?.user?.role, "ALLOCATE_SEATS");

  const { data: events = [], isPending } = useQuery<EventData[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error("Failed to load events");
      return (await res.json()).data ?? [];
    },
  });

  const register = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}/register`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not register");
      return body.data as ViewerRegistration & { registered: boolean };
    },
    onSuccess: (result) => {
      if (result.status === "waitlisted") {
        toast.info(
          "You are on the waitlist",
          `Number ${result.waitlistPosition}. You will be told if a seat opens.`
        );
      } else if (result.allocation === "NEWCOMER_QUOTA") {
        toast.success("Seat confirmed", "You took one of the seats reserved for newcomers.");
      } else {
        toast.success("Seat confirmed", "See you there.");
      }
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error("Could not register", errorMessage(e)),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/events/${id}/register`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not cancel");
      return body.data;
    },
    onSuccess: () => {
      // Cancelling matters to more than the person doing it: the seat goes
      // back into the pool and someone on the waitlist can take it.
      toast.success("Seat released", "Your seat goes back to the waitlist.");
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e) => toast.error("Could not cancel", errorMessage(e)),
  });

  const vote = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not record your vote");
      return body.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
    onError: (e) => toast.error("Could not record your vote", errorMessage(e)),
  });

  const scheduled = events.filter(
    (e) => e.status === "scheduled" && !(e.scheduledAt && isPast(new Date(e.scheduledAt)))
  );
  const proposed = events.filter((e) => e.status === "proposed");
  const past = events.filter(
    (e) =>
      e.status === "completed" ||
      e.status === "cancelled" ||
      (e.status === "scheduled" && e.scheduledAt !== null && isPast(new Date(e.scheduledAt)))
  );

  const shown = tab === "scheduled" ? scheduled : tab === "proposed" ? proposed : past;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto pb-24">
        <header className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-ink-900 tracking-[-0.02em]">
            Events
          </h1>
          <p className="mt-2 text-text-secondary">
            Seats are allocated, not raced for. A share of every event is held for people who
            have not been to one yet.
          </p>
        </header>

        <Tabs
          className="mb-6"
          activeTab={tab}
          onChange={setTab}
          tabs={[
            { id: "scheduled", label: `Scheduled (${scheduled.length})` },
            { id: "proposed", label: `Proposed (${proposed.length})` },
            { id: "past", label: `Past (${past.length})` },
          ]}
        />

        {isPending ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState mark={MarkCalendar}
            title={
              tab === "proposed"
                ? "Nothing proposed yet"
                : tab === "past"
                  ? "Nothing has happened yet"
                  : "Nothing scheduled"
            }
            description={
              tab === "proposed"
                ? "Anyone can propose an event. What gets scheduled is what people vote for."
                : "When faculty schedule something, it appears here with its seat allocation."
            }
          />
        ) : (
          <ul className="space-y-4">
            {shown.map((event) => (
              <li key={event._id}>
                <EventRow
                  event={event}
                  mayAllocate={mayAllocate}
                  busy={
                    register.isPending || cancel.isPending || vote.isPending
                  }
                  onRegister={() => register.mutate(event._id)}
                  onCancel={() => cancel.mutate(event._id)}
                  onVote={() => vote.mutate(event._id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function EventRow({
  event,
  mayAllocate,
  busy,
  onRegister,
  onCancel,
  onVote,
}: {
  event: EventData;
  mayAllocate: boolean;
  busy: boolean;
  onRegister: () => void;
  onCancel: () => void;
  onVote: () => void;
}) {
  const reg = event.viewerRegistration;
  const holdsSeat = reg?.status === "registered" || reg?.status === "attended";
  const waitlisted = reg?.status === "waitlisted";
  const quotaSeats =
    event.capacity === null
      ? null
      : Math.floor((event.capacity * event.newcomerQuotaPercent) / 100);

  return (
    <Card variant="spotlight" className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={KIND_VARIANT[event.kind] ?? "secondary"} className="capitalize">
              {event.kind}
            </Badge>
            {event.track && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                {event.track}
              </span>
            )}
            {holdsSeat && reg?.allocation === "NEWCOMER_QUOTA" && (
              <Badge variant="gold">Reserved seat</Badge>
            )}
          </div>

          <h2 className="mt-3 font-display text-xl text-ink-900">{event.title}</h2>
          {event.description && (
            <p className="mt-1 text-sm text-text-secondary line-clamp-2">{event.description}</p>
          )}

          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-text-muted" />
              <dd>{when(event)}</dd>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-text-muted" />
                <dd>{event.location}</dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-text-muted" />
              <dd>
                {event.capacity === null
                  ? `${event.registered} going, no limit`
                  : `${event.registered} of ${event.capacity} seats taken`}
              </dd>
            </div>
          </dl>

          {quotaSeats !== null && quotaSeats > 0 && event.status === "scheduled" && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
              {quotaSeats} of {event.capacity} seats held for newcomers
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2">
          {event.status === "proposed" ? (
            <>
              <Button
                variant={event.viewerHasVoted ? "secondary" : "gradient"}
                disabled={busy}
                onClick={onVote}
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                {event.viewerHasVoted ? "Voted" : "Vote"}
              </Button>
              <span className="text-center font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                {event.demandVotes} {event.demandVotes === 1 ? "vote" : "votes"}
              </span>
            </>
          ) : holdsSeat ? (
            <>
              <span className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-rule bg-paper-1/40 px-4 py-2 text-sm text-stamp-verified">
                <Check className="h-4 w-4" /> Seat held
              </span>
              <Button variant="secondary" disabled={busy} onClick={onCancel}>
                Release seat
              </Button>
            </>
          ) : waitlisted ? (
            <>
              <span className="rounded-[var(--radius-md)] border border-rule bg-paper-1/40 px-4 py-2 text-center text-sm text-text-secondary">
                Waitlist #{reg?.waitlistPosition}
              </span>
              <Button variant="secondary" disabled={busy} onClick={onCancel}>
                Leave waitlist
              </Button>
            </>
          ) : event.status === "scheduled" ? (
            <Button variant="gradient" disabled={busy} onClick={onRegister}>
              {event.seatsLeft === 0 ? "Join waitlist" : "Take a seat"}
            </Button>
          ) : (
            <span className="rounded-[var(--radius-md)] border border-rule px-4 py-2 text-center text-sm capitalize text-text-muted">
              {event.status}
            </span>
          )}

          {mayAllocate && event.status !== "proposed" && (
            <Link href={`/events/${event._id}/roster`}>
              <Button variant="ghost" className="w-full">
                <ClipboardList className="mr-2 h-4 w-4" /> Roster
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
