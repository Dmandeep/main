"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ExternalLink, X } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { canSessionRole } from "@/lib/authz/permissions";
import { MarkStamp } from "@/components/marks";

/**
 * The review bench.
 *
 * Rebuilt. The previous screen was a generic table that showed a submitter, a
 * type and a date — never the evidence itself, so a reviewer was approving a
 * row they could not inspect. Its reject button also sent no rationale, which
 * the API requires, so every rejection failed with a 422.
 *
 * Decision-critical context first: what the artefact is, where it lives, how
 * long it has been waiting. Everything else is one click away.
 */

interface ReviewItem {
  _id: string;
  title: string;
  description?: string;
  sourceType: string;
  sourceUrl: string;
  sourceExternalId?: string;
  contentHash?: string;
  machineConfidence?: number;
  status: string;
  ageHours: number;
  breachingSla: boolean;
  createdAt: string;
  project: { id: string; slug: string; title: string; track: string };
  milestone?: { ordinal: number; title: string };
  submittedBy: { name: string; username: string; avatarUrl?: string };
}

interface QueueMeta {
  queueDepth: number;
  breaching: number;
  slaHours: number;
}

function formatAge(hours: number): string {
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function AdminReviewPage() {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const queueKey = ["admin-review-queue"];
  const { data: session, status: sessionStatus } = useSession();

  // An HOD reaches this route legitimately — the /admin shell is open to all
  // staff — and the handler behind it refuses them. Without this the page sits
  // in skeletons while the query retries, then shows an empty queue, which
  // reads as "nothing to review" rather than "not yours to review".
  const mayVerify = canSessionRole(session?.user?.role, "VERIFY_EVIDENCE");
  const refused = sessionStatus === "authenticated" && !mayVerify;

  const { data, isPending } = useQuery<{ data: ReviewItem[]; meta: QueueMeta }>({
    queryKey: queueKey,
    enabled: mayVerify,
    queryFn: async () => {
      const res = await fetch("/api/admin/review");
      if (!res.ok) throw new Error("Failed to load the review queue");
      return res.json();
    },
  });


  const items = data?.data ?? [];
  const meta = data?.meta;

  const decide = useMutation({
    mutationFn: async (vars: { id: string; status: "approved" | "rejected"; reviewNotes?: string }) => {
      const res = await fetch(`/api/admin/review/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: vars.status, reviewNotes: vars.reviewNotes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not record the decision");
      return body.data;
    },
    onSuccess: (result) => {
      toast.success(
        result.state === "VERIFIED" ? "Verified" : "Sent back",
        result.state === "VERIFIED"
          ? "Standing has been updated and the student notified."
          : "The student has been told what would make it acceptable."
      );
      queryClient.invalidateQueries({ queryKey: queueKey });
    },
    onError: (e) => toast.error("Could not record the decision", errorMessage(e)),
    onSettled: () => setProcessingId(null),
  });

  if (refused) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto pb-24">
          <header className="mb-8">
            <h1 className="font-display text-3xl md:text-4xl text-ink-900 tracking-[-0.02em]">
              Review queue
            </h1>
          </header>
          <EmptyState mark={MarkStamp}
            title="Verification sits with faculty"
            description="Approving who someone is and verifying what they did are deliberately held by different people, so no single person can enrol a student and then sign off their work. Your approvals are under Access Requests."
            action={{ label: "Go to access requests", href: "/admin/access-requests" }}
          />
        </div>
      </AppShell>
    );
  }

  function approve(item: ReviewItem) {
    setProcessingId(item._id);
    decide.mutate({ id: item._id, status: "approved" });
  }

  function reject(item: ReviewItem) {
    // The API requires a rationale of at least 20 characters. Collecting it
    // here is what makes the button work at all — and a rejection a student
    // cannot understand is a rejection they will appeal.
    const reason = window.prompt(
      `Why is "${item.title}" not acceptable?\n\nThe student sees this. Say what would make it acceptable. At least 20 characters.`
    );
    if (reason === null) return;

    if (reason.trim().length < 20) {
      toast.error(
        "A reason is required",
        "At least 20 characters, describing what would make this acceptable."
      );
      return;
    }

    setProcessingId(item._id);
    decide.mutate({ id: item._id, status: "rejected", reviewNotes: reason.trim() });
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto pb-24">
        <header className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl text-ink-900 tracking-[-0.02em]">
            Review queue
          </h1>
          <p className="mt-2 text-text-secondary">
            Oldest first. Nothing earns standing until it is signed here.
          </p>

          {meta && (
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] uppercase tracking-[0.1em]">
              <div>
                <dt className="text-text-muted">Waiting</dt>
                <dd className="text-ink-900 text-lg tabular-nums">{meta.queueDepth}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Past {meta.slaHours}h</dt>
                <dd
                  className={`text-lg tabular-nums ${
                    meta.breaching > 0 ? "text-stamp-rejected" : "text-ink-900"
                  }`}
                >
                  {meta.breaching}
                </dd>
              </div>
            </dl>
          )}
        </header>

        {meta && meta.breaching > 0 && (
          <Card className="p-4 mb-6 border-stamp-rejected/40">
            <p className="flex items-start gap-3 text-sm text-ink-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-stamp-rejected" aria-hidden />
              <span>
                {meta.breaching} {meta.breaching === 1 ? "submission has" : "submissions have"} been
                waiting longer than {meta.slaHours} hours. A slow queue is the fastest way to teach
                students that nobody reads their work.
              </span>
            </p>
          </Card>
        )}

        {isPending ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState mark={MarkStamp}
            title="Queue is clear"
            description="Every submission has been reviewed. Students are not waiting on anyone."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const busy = processingId === item._id;
              return (
                <li key={item._id}>
                  <Card className={`p-5 ${item.breachingSla ? "border-stamp-rejected/40" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{item.sourceType.replace(/_/g, " ")}</Badge>
                          <Badge variant={item.breachingSla ? "danger" : "warning"}>
                            {formatAge(item.ageHours)} waiting
                          </Badge>
                          {item.milestone && (
                            <Badge variant="secondary">
                              Milestone {item.milestone.ordinal}
                            </Badge>
                          )}
                        </div>

                        <h2 className="mt-3 text-lg text-ink-900 font-medium">{item.title}</h2>

                        {item.description && (
                          <p className="mt-1 text-sm text-text-secondary">{item.description}</p>
                        )}

                        <Link
                          href={`/ideas/${item.project.slug}`}
                          className="mt-1 inline-block text-sm text-text-secondary hover:text-ink-900 underline underline-offset-4 decoration-rule"
                        >
                          {item.project.title}
                        </Link>

                        {/* The artefact itself. Without this the reviewer is
                            approving a row rather than inspecting evidence. */}
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 flex items-center gap-2 min-h-[44px] font-mono text-xs text-ink-700 hover:text-ink-900 break-all"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          {item.sourceUrl}
                        </a>

                        {item.contentHash && (
                          <p className="mt-1 font-mono text-[10px] text-text-muted break-all">
                            {item.contentHash}
                          </p>
                        )}

                        <div className="mt-3 flex items-center gap-2">
                          <Avatar name={item.submittedBy.name} src={item.submittedBy.avatarUrl} size="sm" />
                          <span className="text-sm text-text-secondary">
                            {item.submittedBy.name}
                          </span>
                          {typeof item.machineConfidence === "number" && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-muted">
                              machine {Math.round(item.machineConfidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="min-h-[44px]"
                          disabled={busy}
                          onClick={() => reject(item)}
                        >
                          <X className="h-4 w-4 mr-1" aria-hidden /> Send back
                        </Button>
                        <Button
                          size="sm"
                          className="min-h-[44px]"
                          loading={busy && decide.variables?.status === "approved"}
                          disabled={busy}
                          onClick={() => approve(item)}
                        >
                          <Check className="h-4 w-4 mr-1" aria-hidden /> Verify
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
