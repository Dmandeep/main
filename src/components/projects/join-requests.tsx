"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { MarkHandoff } from "@/components/marks";

/**
 * Requests to join a project, for its owner.
 *
 * Renders nothing when there is nothing waiting, so a project page is not
 * permanently carrying an empty admin box.
 *
 * Declining does not delete the person's history with the project — the
 * request row keeps its decision, because "I asked and was told no" is a
 * different state from "I never asked", and the owner should not be able to
 * quietly erase the first.
 */

interface JoinRequestRow {
  _id: string;
  role: string;
  message?: string;
  createdAt: string;
  user: { _id: string; name: string; username: string; avatarUrl?: string };
}

export function ProjectJoinRequests({
  projectId,
  canDecide,
}: {
  projectId: string;
  canDecide: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["project-join-requests", projectId];

  const { data: requests = [] } = useQuery<JoinRequestRow[]>({
    queryKey: key,
    enabled: canDecide,
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${projectId}/join`);
      if (!res.ok) throw new Error("Could not load join requests");
      return (await res.json()).data ?? [];
    },
  });

  const decide = useMutation({
    mutationFn: async (vars: { requestId: string; status: "approved" | "rejected" }) => {
      const res = await fetch(`/api/ideas/${projectId}/join`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not answer the request");
      return { ...body.data, status: vars.status };
    },
    onSuccess: (result) => {
      toast.success(
        result.status === "approved" ? "Added to the team" : "Declined",
        result.status === "approved"
          ? "They can post updates and attach evidence now."
          : "They have been told, and can ask again later."
      );
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["idea", projectId] });
    },
    onError: (e) => toast.error("Could not answer the request", errorMessage(e)),
  });

  if (!canDecide || requests.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-stamp-pending/40 bg-stamp-pending/[0.06] p-5">
      <header className="mb-4 flex items-center gap-2.5">
        <MarkHandoff className="h-7 w-7 text-stamp-pending" />
        <h2 className="font-display text-lg text-ink-900">
          {requests.length} {requests.length === 1 ? "person wants" : "people want"} to help
        </h2>
      </header>

      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {requests.map((r) => (
            <motion.li
              key={r._id}
              layout
              exit={{ opacity: 0, height: 0 }}
              className="rounded-[var(--radius-md)] bg-paper-0 p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={r.user.name} src={r.user.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-900">
                    {r.user.name}{" "}
                    <span className="text-ink-500">wants to do</span>{" "}
                    <span className="font-medium">{r.role}</span>
                  </p>
                  <p className="truncate text-[13px] text-ink-500">
                    @{r.user.username} · asked{" "}
                    {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {r.message && (
                <p className="mt-3 border-l-2 border-rule pl-3 text-[15px] leading-relaxed text-ink-700">
                  {r.message}
                </p>
              )}

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ requestId: r._id, status: "approved" })}
                >
                  Add to the team
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ requestId: r._id, status: "rejected" })}
                >
                  Not this time
                </Button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
