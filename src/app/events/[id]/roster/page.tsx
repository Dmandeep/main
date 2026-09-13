"use client";

import { use } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/ToastSystem";
import { canSessionRole } from "@/lib/authz/permissions";
import { errorMessage } from "@/lib/utils";
import { MarkSeat } from "@/components/marks";

/**
 * The allocation roster.
 *
 * The API computes and returns the quota accounting; this screen shows it
 * rather than recomputing it, so what a faculty member sees is exactly what
 * the server would defend if a student asked why someone else got in.
 *
 * Unfilled reserved seats are shown as a normal state, not an error. They are
 * the quota working: held open rather than handed to the already-ranked.
 */

interface RosterUser {
  _id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  year?: number;
  department?: string;
  points: number;
  tier: string;
}

interface RosterRow {
  _id: string;
  status: string;
  allocation: string | null;
  waitlistPosition: number | null;
  registeredAt: string;
  isNewcomer: boolean;
  user: RosterUser;
}

interface RosterResponse {
  event: {
    _id: string;
    title: string;
    status: string;
    startsAt: string | null;
    location?: string;
    capacity: number | null;
    newcomerQuotaPercent: number;
  };
  allocation: {
    capacity: number | null;
    seatsHeld: number;
    seatsLeft: number | null;
    quotaSeats: number | null;
    quotaUsed: number;
    quotaUnfilled: number | null;
    waitlisted: number;
    cancelled: number;
    newcomerShare: number;
  };
  registered: RosterRow[];
  waitlist: RosterRow[];
  cancelled: RosterRow[];
}

type Action = "promote" | "remove" | "mark_attended" | "mark_no_show" | "override_seat";

const ALLOCATION_LABEL: Record<string, string> = {
  NEWCOMER_QUOTA: "Reserved",
  OPEN: "Open",
  STANDING_PRIORITY: "Standing",
  FACULTY_OVERRIDE: "Override",
};

export default function EventRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { data: session, status: sessionStatus } = useSession();
  const mayAllocate = canSessionRole(session?.user?.role, "ALLOCATE_SEATS");
  const rosterKey = ["event-roster", id];

  const { data, isPending } = useQuery<RosterResponse>({
    queryKey: rosterKey,
    enabled: mayAllocate,
    queryFn: async () => {
      const res = await fetch(`/api/events/${id}/roster`);
      if (!res.ok) throw new Error("Failed to load the roster");
      return (await res.json()).data;
    },
  });

  const act = useMutation({
    mutationFn: async (vars: { registrationId: string; action: Action; reason?: string }) => {
      const res = await fetch(`/api/events/${id}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update the registration");
      return body.data;
    },
    onSuccess: () => {
      toast.success("Roster updated", "The change is recorded against your name.");
      queryClient.invalidateQueries({ queryKey: rosterKey });
    },
    onError: (e) => toast.error("Could not update the roster", errorMessage(e)),
  });

  function promote(row: RosterRow) {
    act.mutate({ registrationId: row._id, action: "promote" });
  }

  function remove(row: RosterRow) {
    act.mutate({ registrationId: row._id, action: "remove" });
  }

  function override(row: RosterRow) {
    // Over-capacity seats need a reason, which the API enforces and which is
    // written to the audit log under the name of whoever granted it.
    const reason = window.prompt(
      `Grant ${row.user.name} a seat over capacity?\n\nSay why. This is recorded against your name.`
    );
    if (reason === null) return;
    act.mutate({ registrationId: row._id, action: "override_seat", reason: reason.trim() });
  }

  if (sessionStatus === "authenticated" && !mayAllocate) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl pb-24">
          <EmptyState mark={MarkSeat}
            title="Not your allocation to make"
            description="Seat allocation is held by faculty, the department head and admins."
            action={{ label: "Back to events", href: "/events" }}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl pb-24">
        <Link
          href="/events"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to events
        </Link>

        {isPending || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            <header className="mb-8">
              <h1 className="font-display text-3xl text-ink-900 tracking-[-0.02em]">
                {data.event.title}
              </h1>
              <p className="mt-2 text-text-secondary">
                {data.event.startsAt
                  ? format(new Date(data.event.startsAt), "EEE d MMM, h:mma")
                  : "Not scheduled"}
                {data.event.location ? ` · ${data.event.location}` : ""}
              </p>
            </header>

            <Card variant="glass" className="mb-8 p-6">
              <dl className="flex flex-wrap gap-x-10 gap-y-4 font-mono text-[11px] uppercase tracking-[0.1em]">
                <Figure label="Seats held" value={data.allocation.seatsHeld} />
                <Figure
                  label="Seats left"
                  value={data.allocation.seatsLeft ?? "No limit"}
                />
                <Figure
                  label="Reserved used"
                  value={
                    data.allocation.quotaSeats === null
                      ? "n/a"
                      : `${data.allocation.quotaUsed} / ${data.allocation.quotaSeats}`
                  }
                />
                <Figure label="Waitlisted" value={data.allocation.waitlisted} />
                <Figure label="Newcomer share" value={`${data.allocation.newcomerShare}%`} />
              </dl>

              {data.allocation.quotaUnfilled !== null && data.allocation.quotaUnfilled > 0 && (
                <p className="mt-5 border-t border-rule pt-4 text-sm text-text-secondary">
                  {data.allocation.quotaUnfilled} reserved{" "}
                  {data.allocation.quotaUnfilled === 1 ? "seat is" : "seats are"} still open. These
                  are held for people who have not been to an event yet, and stay held rather than
                  being released to the waitlist.
                </p>
              )}
            </Card>

            <Section
              title="Holding a seat"
              rows={data.registered}
              empty="Nobody has taken a seat yet."
              busy={act.isPending}
              actions={(row) => (
                <Button variant="ghost" onClick={() => remove(row)} disabled={act.isPending}>
                  Remove
                </Button>
              )}
            />

            <Section
              title="Waitlist"
              rows={data.waitlist}
              empty="Nobody is waiting."
              busy={act.isPending}
              actions={(row) => (
                <>
                  <Button variant="secondary" onClick={() => promote(row)} disabled={act.isPending}>
                    Promote
                  </Button>
                  <Button variant="ghost" onClick={() => override(row)} disabled={act.isPending}>
                    Override
                  </Button>
                </>
              )}
            />

            {data.cancelled.length > 0 && (
              <Section
                title="Cancelled"
                rows={data.cancelled}
                empty=""
                busy={act.isPending}
                actions={() => null}
              />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="mt-1 text-lg tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}

function Section({
  title,
  rows,
  empty,
  actions,
}: {
  title: string;
  rows: RosterRow[];
  empty: string;
  busy: boolean;
  actions: (row: RosterRow) => React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 font-display text-lg text-ink-900">
        {title}{" "}
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
          {rows.length}
        </span>
      </h2>

      {rows.length === 0 ? (
        empty ? (
          <p className="text-sm text-text-secondary">{empty}</p>
        ) : null
      ) : (
        <ul className="divide-y divide-rule rounded-[var(--radius-lg)] border border-rule">
          {rows.map((row) => (
            <li key={row._id} className="flex flex-wrap items-center gap-4 p-4">
              <Avatar src={row.user.avatarUrl} name={row.user.name} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-900">{row.user.name}</p>
                <p className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  @{row.user.username}
                  {row.user.year ? ` · Year ${row.user.year}` : ""} · {row.user.points} pts
                </p>
              </div>

              <div className="flex items-center gap-2">
                {row.isNewcomer && <Badge variant="gold">Newcomer</Badge>}
                {row.allocation && (
                  <Badge variant="secondary">
                    {ALLOCATION_LABEL[row.allocation] ?? row.allocation}
                  </Badge>
                )}
                {row.waitlistPosition !== null && (
                  <span className="font-mono text-[11px] text-text-muted">
                    #{row.waitlistPosition}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">{actions(row)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
