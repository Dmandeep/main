"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { MarkRoom } from "@/components/marks";

/**
 * Pending join requests, for the people who can answer them.
 *
 * Renders nothing at all when there is nothing waiting, and nothing when the
 * viewer cannot moderate — the endpoint refuses those callers anyway, so the
 * panel simply stays out of the way rather than showing an empty box on every
 * community page.
 *
 * A rejection deletes the row rather than tombstoning it, so the wording says
 * "not now" rather than implying a permanent ban: the student can ask again.
 */

interface JoinRequest {
  _id: string;
  requestedAt: string;
  user: { _id: string; name: string; username: string; avatarUrl?: string };
}

export function JoinRequests({ slug, canModerate }: { slug: string; canModerate: boolean }) {
  const queryClient = useQueryClient();
  const key = ["community-requests", slug];

  const { data: requests = [] } = useQuery<JoinRequest[]>({
    queryKey: key,
    enabled: canModerate,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${slug}/requests`);
      if (!res.ok) throw new Error("Could not load join requests");
      return (await res.json()).data ?? [];
    },
  });

  const answer = useMutation({
    mutationFn: async (vars: { memberId: string; decision: "approve" | "reject" }) => {
      const res = await fetch(`/api/communities/${slug}/requests`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not answer the request");
      return body.data;
    },
    onSuccess: (result) => {
      toast.success(
        result.decision === "approve" ? "Approved" : "Not added",
        result.decision === "approve"
          ? "They can post here now, and have been told."
          : "They can ask again later."
      );
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (e) => toast.error("Could not answer the request", errorMessage(e)),
  });

  if (!canModerate || requests.length === 0) return null;

  return (
    <section className="mb-4 rounded-[var(--radius-lg)] border border-stamp-pending/40 bg-stamp-pending/[0.06] p-4">
      <header className="mb-3 flex items-center gap-2.5">
        <MarkRoom className="h-6 w-6 text-stamp-pending" />
        <h2 className="font-display text-base text-ink-900">
          {requests.length} {requests.length === 1 ? "person wants" : "people want"} to join
        </h2>
      </header>

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {requests.map((r) => (
            <motion.li
              key={r._id}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-paper-0 p-3"
            >
              <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink-900">{r.user.name}</p>
                <p className="truncate text-[13px] text-ink-500">
                  @{r.user.username} · asked{" "}
                  {formatDistanceToNowStrict(new Date(r.requestedAt), { addSuffix: true })}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ memberId: r._id, decision: "approve" })}
                >
                  Add them
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={answer.isPending}
                  onClick={() => answer.mutate({ memberId: r._id, decision: "reject" })}
                >
                  Not now
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
