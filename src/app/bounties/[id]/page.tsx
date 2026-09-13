"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Clock, Lock, ShieldCheck, Users, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface BountySubmissionView {
  _id: string;
  summary: string;
  status: string;
  reviewNote?: string;
  submittedAt: string;
  awardedAt: string | null;
  evidenceCount: number;
  user: { _id: string; name: string; username: string; avatarUrl?: string };
}

interface BountyDetail {
  _id: string;
  title: string;
  description: string;
  kind: string;
  track?: string;
  skillsNeeded: string[];
  rewardPoints: number;
  reservedForNewcomers: boolean;
  maxClaims: number;
  placesLeft: number;
  status: string;
  closesAt: string | null;
  postedBy: { _id: string; name: string; username: string; avatarUrl?: string; bio?: string };
  counts: { total: number; awarded: number; open: number };
  submissions: BountySubmissionView[];
  viewer: { canClaim: boolean; reason: string | null; message: string; isNewcomer: boolean };
}

const STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "default"> = {
  awarded: "success",
  submitted: "warning",
  under_review: "warning",
  rejected: "danger",
  withdrawn: "default",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [summary, setSummary] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);

  const bountyKey = ["bounty", id];

  const { data: bounty, isPending } = useQuery<BountyDetail>({
    queryKey: bountyKey,
    queryFn: async () => {
      const res = await fetch(`/api/bounties/${id}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load bounty");
      return (await res.json()).data;
    },
  });

  /** The caller's own evidence, so a submission can only cite work they made. */
  const { data: myEvidence = [] } = useQuery<{ _id: string; title: string; state: string }[]>({
    queryKey: ["my-evidence"],
    enabled: showForm,
    queryFn: async () => {
      const dash = await fetch("/api/dashboard").then((r) => r.json());
      const projects: { _id: string }[] = dash.data?.myIdeas ?? [];
      const all = await Promise.all(
        projects.map((p) =>
          fetch(`/api/ideas/${p._id}/proof`)
            .then((r) => r.json())
            .then((b) => b.data ?? [])
        )
      );
      const mine = all.flat() as { _id: string; title: string; state: string; submitter: { _id: string } }[];
      return mine.filter((e) => e.submitter?._id === session?.user?.id);
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/bounties/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, evidenceIds }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not submit");
      return body.data;
    },
    onSuccess: () => {
      toast.success("Submitted", "The person who posted this bounty has been notified.");
      setShowForm(false);
      setSummary("");
      setEvidenceIds([]);
      queryClient.invalidateQueries({ queryKey: bountyKey });
    },
    onError: (e) => toast.error("Could not submit", errorMessage(e)),
  });

  const decideMutation = useMutation({
    mutationFn: async (vars: { submissionId: string; decision: "AWARDED" | "REJECTED"; reviewNote?: string }) => {
      const res = await fetch(`/api/bounties/${id}/submit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not record decision");
      return body.data;
    },
    onSuccess: (data) => {
      toast.success(
        data.status === "AWARDED" ? "Awarded" : "Recorded",
        data.status === "AWARDED" ? "Standing has been updated." : "The submitter has been told why."
      );
      queryClient.invalidateQueries({ queryKey: bountyKey });
    },
    onError: (e) => toast.error("Could not record decision", errorMessage(e)),
  });

  if (isPending) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </AppShell>
    );
  }

  if (!bounty) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto text-center py-20">
          <h2 className="text-2xl font-display text-ink-900 mb-2">Bounty not found</h2>
          <p className="text-text-secondary mb-6">
            It may have been closed, or it belongs to another department.
          </p>
          <Link href="/bounties">
            <Button variant="secondary">Back to bounties</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const isPoster = bounty.postedBy._id === session?.user?.id;
  const canDecide = isPoster || session?.user?.role === "admin";
  const deadlinePassed = bounty.closesAt ? new Date(bounty.closesAt) < new Date() : false;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-24">
        <Link
          href="/bounties"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm text-text-secondary hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> All bounties
        </Link>

        <header className="mt-4 mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline">{bounty.kind}</Badge>
            <Badge variant={bounty.status === "open" ? "success" : "default"}>{bounty.status}</Badge>
            {bounty.reservedForNewcomers && (
              <Badge variant="info">
                <Lock className="h-3 w-3" aria-hidden /> Held for newcomers
              </Badge>
            )}
          </div>

          <h1 className="font-display text-3xl md:text-4xl text-ink-900 tracking-[-0.02em]">
            {bounty.title}
          </h1>

          {/* Mono metadata: these are facts, not prose. */}
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.06em]">
            <div>
              <dt className="text-text-muted">Reward</dt>
              <dd className="text-ink-900 text-sm tabular-nums">{bounty.rewardPoints} pts</dd>
            </div>
            <div>
              <dt className="text-text-muted">Places left</dt>
              <dd className="text-ink-900 text-sm tabular-nums">
                {bounty.placesLeft} of {bounty.maxClaims}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Submissions</dt>
              <dd className="text-ink-900 text-sm tabular-nums">
                {bounty.counts.total} · {bounty.counts.awarded} awarded
              </dd>
            </div>
            {bounty.closesAt && (
              <div>
                <dt className="text-text-muted">Closes</dt>
                <dd className={deadlinePassed ? "text-stamp-rejected text-sm" : "text-ink-900 text-sm"}>
                  {formatDate(bounty.closesAt)}
                </dd>
              </div>
            )}
          </dl>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="font-display text-lg text-ink-900 mb-3">What done looks like</h2>
              <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                {bounty.description}
              </p>

              {bounty.skillsNeeded.length > 0 && (
                <div className="mt-5 pt-5 border-t border-rule-soft flex flex-wrap gap-2">
                  {bounty.skillsNeeded.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>

            {/* Claim state. Always says WHY, never just a disabled button. */}
            {!canDecide && (
              <Card className="p-6">
                {bounty.viewer.canClaim ? (
                  showForm ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitMutation.mutate();
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label
                          htmlFor="summary"
                          className="block text-sm font-medium text-ink-900 mb-1"
                        >
                          What did you do?
                        </label>
                        <textarea
                          id="summary"
                          required
                          minLength={30}
                          value={summary}
                          onChange={(e) => setSummary(e.target.value)}
                          rows={4}
                          className="w-full rounded-[var(--r-md)] border border-rule bg-paper-0 p-3 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900 focus:ring-offset-2"
                          placeholder="Say what you did and where the work is."
                        />
                        <p className="mt-1 text-xs text-text-muted">
                          At least 30 characters.
                        </p>
                      </div>

                      <fieldset>
                        <legend className="text-sm font-medium text-ink-900 mb-1">
                          Evidence backing this
                        </legend>
                        <p className="text-xs text-text-muted mb-2">
                          A bounty pays for proof, so at least one is required. Only your own
                          evidence is listed.
                        </p>
                        {myEvidence.length === 0 ? (
                          <p className="text-sm text-text-secondary border border-rule rounded-[var(--r-md)] p-3">
                            You have no evidence yet. Submit some on a project first, then come
                            back — it takes under a minute.
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {myEvidence.map((e) => (
                              <label
                                key={e._id}
                                className="flex items-center gap-3 min-h-[44px] px-3 rounded-[var(--r-sm)] hover:bg-paper-1 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={evidenceIds.includes(e._id)}
                                  onChange={(ev) =>
                                    setEvidenceIds((prev) =>
                                      ev.target.checked
                                        ? [...prev, e._id]
                                        : prev.filter((x) => x !== e._id)
                                    )
                                  }
                                  className="h-4 w-4 accent-[var(--ink-900)]"
                                />
                                <span className="text-sm text-ink-900 flex-1">{e.title}</span>
                                <Badge variant={e.state === "VERIFIED" ? "success" : "warning"}>
                                  {e.state}
                                </Badge>
                              </label>
                            ))}
                          </div>
                        )}
                      </fieldset>

                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          loading={submitMutation.isPending}
                          disabled={summary.trim().length < 30 || evidenceIds.length === 0}
                          className="min-h-[44px]"
                        >
                          Submit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowForm(false)}
                          className="min-h-[44px]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-ink-900">You can claim this.</p>
                        <p className="text-sm text-text-secondary">
                          {bounty.placesLeft} of {bounty.maxClaims} places left.
                        </p>
                      </div>
                      <Button onClick={() => setShowForm(true)} className="min-h-[44px]">
                        Claim this bounty
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="flex items-start gap-3">
                    <Lock className="h-4 w-4 mt-1 text-text-muted shrink-0" aria-hidden />
                    <div>
                      <p className="font-medium text-ink-900">Not open to you</p>
                      <p className="text-sm text-text-secondary">{bounty.viewer.message}</p>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {/* Submissions */}
            <section>
              <h2 className="font-display text-lg text-ink-900 mb-3">
                Submissions{" "}
                <span className="font-mono text-sm text-text-muted tabular-nums">
                  {bounty.counts.total}
                </span>
              </h2>

              {bounty.submissions.length === 0 ? (
                <Card className="p-6 text-sm text-text-secondary">
                  Nothing submitted yet.
                </Card>
              ) : (
                <ul className="space-y-3">
                  {bounty.submissions.map((s) => (
                    <li key={s._id}>
                      <Card className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar name={s.user.name} src={s.user.avatarUrl} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                href={`/profile/${s.user.username}`}
                                className="font-medium text-ink-900 hover:underline"
                              >
                                {s.user.name}
                              </Link>
                              <Badge variant={STATUS_BADGE[s.status] ?? "default"}>
                                {s.status}
                              </Badge>
                              <span className="font-mono text-[11px] text-text-muted tabular-nums">
                                {formatDate(s.submittedAt)}
                              </span>
                            </div>

                            <p className="mt-2 text-sm text-text-secondary">{s.summary}</p>

                            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted">
                              <ShieldCheck className="inline h-3 w-3 mr-1" aria-hidden />
                              {s.evidenceCount} evidence item{s.evidenceCount === 1 ? "" : "s"}
                            </p>

                            {s.reviewNote && (
                              <p className="mt-2 text-sm text-text-secondary border-l-2 border-rule pl-3">
                                {s.reviewNote}
                              </p>
                            )}

                            {canDecide && s.status === "submitted" && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="min-h-[44px]"
                                  loading={decideMutation.isPending}
                                  onClick={() =>
                                    decideMutation.mutate({
                                      submissionId: s._id,
                                      decision: "AWARDED",
                                    })
                                  }
                                >
                                  <Check className="h-4 w-4 mr-1" aria-hidden /> Award
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="min-h-[44px]"
                                  onClick={() => {
                                    const reason = window.prompt(
                                      "Why is this not accepted? The submitter sees this. At least 20 characters."
                                    );
                                    if (!reason || reason.trim().length < 20) {
                                      toast.error(
                                        "Reason required",
                                        "A rejection needs at least 20 characters explaining what would make it acceptable."
                                      );
                                      return;
                                    }
                                    decideMutation.mutate({
                                      submissionId: s._id,
                                      decision: "REJECTED",
                                      reviewNote: reason.trim(),
                                    });
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" aria-hidden /> Not yet
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card className="p-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted mb-3">
                Posted by
              </h3>
              <div className="flex items-center gap-3">
                <Avatar name={bounty.postedBy.name} src={bounty.postedBy.avatarUrl} />
                <div className="min-w-0">
                  <Link
                    href={`/profile/${bounty.postedBy.username}`}
                    className="font-medium text-ink-900 hover:underline block truncate"
                  >
                    {bounty.postedBy.name}
                  </Link>
                  {bounty.postedBy.bio && (
                    <p className="text-xs text-text-muted line-clamp-2">{bounty.postedBy.bio}</p>
                  )}
                </div>
              </div>
            </Card>

            {bounty.reservedForNewcomers && (
              <Card className="p-5">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted mb-2">
                  Why this is reserved
                </h3>
                <p className="text-sm text-text-secondary">
                  Held for students with no verified work yet. It stays open for them even when
                  everything else is taken — otherwise the people who most need a first result are
                  the ones who never get one.
                </p>
              </Card>
            )}

            <Card className="p-5">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-muted mb-3">
                How it pays
              </h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex gap-2">
                  <Users className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                  Submitting earns nothing.
                </li>
                <li className="flex gap-2">
                  <Check className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                  An award adds {bounty.rewardPoints} to your standing, once.
                </li>
                <li className="flex gap-2">
                  <Clock className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
                  Every award opens its own record.
                </li>
              </ul>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
