"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { kindStyle } from "@/lib/feed/accent";

/**
 * Writing a post.
 *
 * Collapsed to a single line until it is clicked. A permanent three-field form
 * at the top of a feed is a demand; one line that opens when you have
 * something to say is an invitation, and the feed is for reading most of the
 * time.
 *
 * A post has to go somewhere — the API enforces it — so the room is chosen
 * before the button enables rather than after a rejected submit. Only rooms
 * the person can actually post in are offered: showing a community they would
 * be refused from is a worse experience than not showing it.
 */

const KINDS = [
  { id: "UPDATE", label: "Update", hint: "What changed since last week" },
  { id: "ASK_FOR_HELP", label: "Ask for help", hint: "What you are stuck on" },
  { id: "SHOWCASE", label: "Showcase", hint: "Something that works now" },
  { id: "MILESTONE", label: "Milestone", hint: "Something finished" },
] as const;

interface CommunityOption {
  _id: string;
  name: string;
  slug: string;
  viewer: { isMember: boolean };
  isSystemManaged: boolean;
}

export function PostComposer() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("UPDATE");
  const [communityId, setCommunityId] = useState("");

  const { data: communities = [] } = useQuery<CommunityOption[]>({
    queryKey: ["communities"],
    enabled: open,
    queryFn: async () => {
      const res = await fetch("/api/communities");
      if (!res.ok) throw new Error("Could not load your communities");
      return (await res.json()).data ?? [];
    },
  });

  // Only where they are actually a member. System rooms are included: a
  // student belongs to their batch room by virtue of being in the batch.
  const canPostIn = communities.filter((c) => c.viewer.isMember);

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), kind, communityId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not post");
      return payload.data;
    },
    onSuccess: () => {
      toast.success("Posted", "It is in the feed and in the room.");
      setBody("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e) => toast.error("Could not post", errorMessage(e)),
  });

  const style = kindStyle("post");
  const ready = body.trim().length >= 10 && communityId.length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-rule bg-paper-0 p-4 text-left transition-colors hover:border-ink-300"
      >
        <Avatar name={session?.user?.name ?? "?"} size="sm" />
        <span className="text-[15px] text-ink-500">
          Share something with your department…
        </span>
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] border p-4"
      style={{ borderColor: style.edge, background: style.wash }}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={kind === k.id}
            onClick={() => setKind(k.id)}
            title={k.hint}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              kind === k.id ? "border-transparent text-paper-0" : "border-rule bg-paper-0 text-ink-700"
            }`}
            style={kind === k.id ? { background: style.ink } : undefined}
          >
            {k.label}
          </button>
        ))}
      </div>

      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder={KINDS.find((k) => k.id === kind)?.hint}
        className="w-full resize-none rounded-[var(--radius-md)] border border-rule bg-paper-0 px-3 py-2.5 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-300 focus:border-ink-900 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
          className="cursor-pointer rounded-[var(--radius-md)] border border-rule bg-paper-0 px-3 py-2 text-[13px] text-ink-900 focus:border-ink-900 focus:outline-none"
        >
          <option value="">Post to…</option>
          {canPostIn.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>

        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-500">
          {body.trim().length}/2000
        </span>

        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!ready || create.isPending}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            Post
          </Button>
        </div>
      </div>

      {canPostIn.length === 0 && (
        <p className="mt-3 text-[13px] text-ink-700">
          You are not in any room yet. Join one and you can post here.
        </p>
      )}
    </motion.div>
  );
}
