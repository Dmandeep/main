"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { MarkHandoff } from "@/components/marks";

/**
 * Asking to join a project.
 *
 * The endpoint for this existed from the start and nothing in the product ever
 * called it — the single most collaborative act available, and it was
 * unreachable. A feed full of projects you cannot offer to help with is a
 * noticeboard, not a campus.
 *
 * The role is asked for rather than free-typed into a message, because the
 * owner's decision is almost always "do I need a person who does that" and a
 * paragraph buries it. The message is optional and short.
 */

interface Props {
  projectId: string;
  skillsNeeded: string[];
  existingRequest: { status: string; role: string } | null;
}

export function JoinProject({ projectId, skillsNeeded, existingRequest }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(skillsNeeded[0] ?? "");
  const [message, setMessage] = useState("");

  const ask = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ideas/${projectId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: role.trim(), message: message.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send your request");
      return body.data;
    },
    onSuccess: () => {
      toast.success("Asked to join", "The owner has been told. You will hear back either way.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["idea", projectId] });
    },
    onError: (e) => toast.error("Could not send your request", errorMessage(e)),
  });

  if (existingRequest) {
    const pending = existingRequest.status === "pending";
    return (
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-lg)] border p-4 ${
          pending ? "border-rule bg-paper-1" : "border-stamp-verified/40 bg-stamp-verified/[0.07]"
        }`}
      >
        {pending ? (
          <MarkHandoff className="h-8 w-8 shrink-0 text-ink-300" />
        ) : (
          <Check className="h-6 w-6 shrink-0 text-stamp-verified" />
        )}
        <div>
          <p className="text-sm font-medium text-ink-900">
            {pending
              ? `You asked to join as ${existingRequest.role}`
              : existingRequest.status === "approved"
                ? "You are on this team"
                : "This request was declined"}
          </p>
          <p className="text-[13px] text-ink-700">
            {pending
              ? "Waiting on the owner. You will be notified either way."
              : existingRequest.status === "approved"
                ? "Post an update or attach evidence when you have something."
                : "You can ask again if the project needs someone later."}
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="primary" className="w-full" onClick={() => setOpen(true)}>
        <Handshake className="mr-2 h-4 w-4" />
        Ask to join
      </Button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] border border-rule bg-paper-1 p-4"
    >
      <p className="mb-3 font-display text-base text-ink-900">What would you do on this?</p>

      {skillsNeeded.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {skillsNeeded.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => setRole(skill)}
              aria-pressed={role === skill}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                role === skill
                  ? "border-ink-900 bg-ink-900 text-paper-0"
                  : "border-rule text-ink-700 hover:border-ink-300"
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      )}

      <Input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Backend, UI, testing…"
        maxLength={50}
      />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={300}
        placeholder="Optional: anything you have done that is relevant."
        className="mt-3 w-full resize-none rounded-[var(--radius-md)] border border-rule bg-paper-0 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:border-stamp-verified focus:outline-none focus:ring-2 focus:ring-ink-900/40"
      />

      <div className="mt-3 flex gap-2">
        <Button
          variant="primary"
          disabled={role.trim().length < 2 || ask.isPending}
          loading={ask.isPending}
          onClick={() => ask.mutate()}
        >
          Send the request
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
