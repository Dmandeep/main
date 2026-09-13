"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Send } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";
import { getPusherClient } from "@/lib/pusher-client";
import { MessageList, type Message } from "@/components/communities/message-list";
import { communityAccent, kindAccent } from "@/lib/communities/palette";
import { JoinRequests } from "@/components/communities/join-requests";

interface Meta {
  community: { _id: string; slug: string; name: string; kind: string; archived: boolean };
  canPost: boolean;
  canModerate: boolean;
  postBlockedReason: string | null;
  postBlockedMessage: string | null;
  encryption: string;
}

export default function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messagesKey = ["community-messages", slug];

  const { data, isPending, isError } = useQuery<{ data: Message[]; meta: Meta }>({
    queryKey: messagesKey,
    queryFn: async () => {
      const res = await fetch(`/api/communities/${slug}/messages`);
      if (!res.ok) throw new Error("Could not load this community");
      return res.json();
    },
  });

  const messages = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    const pusher = getPusherClient();
    const channelName = `community-${slug}`;
    const channel = pusher.subscribe(channelName);
    
    channel.bind("message-new", (newMessage: Message) => {
      queryClient.setQueryData<{ data: Message[]; meta: Meta }>(messagesKey, (prev) => {
        if (!prev) return prev;
        if (prev.data.some(m => m._id === newMessage._id)) return prev;
        return { ...prev, data: [...prev.data, newMessage] };
      });
    });

    return () => {
      pusher.unsubscribe(channelName);
    };
  }, [slug, queryClient, messagesKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch(`/api/communities/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not send");
      return payload.data as Message;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<{ data: Message[]; meta: Meta }>(messagesKey, (prev) =>
        prev ? { ...prev, data: [...prev.data, message] } : prev
      );
      setDraft("");
    },
    onError: (e) => toast.error("Not sent", errorMessage(e)),
  });

  if (isPending) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-14 w-full" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (isError || !meta) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto text-center py-20">
          <h2 className="font-display text-2xl text-ink-900 mb-2">Community not found</h2>
          <p className="text-text-secondary mb-6">
            It may be private, archived, or belong to another department.
          </p>
          <Link href="/communities">
            <Button variant="secondary" className="min-h-[44px]">
              All communities
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  // Identity colour, stable for the life of the community.
  const accent = communityAccent(meta.community.slug);
  const kind = kindAccent(meta.community.kind);

  function submit() {
    const body = draft.trim();
    if (body) send.mutate(body);
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
        {/* Header carries the room's colour so switching rooms is felt, not read. */}
        <header
          className="shrink-0 rounded-[var(--r-lg)] border border-rule overflow-hidden"
          style={{ backgroundColor: accent.wash }}
        >
          <div className="h-1" style={{ backgroundColor: accent.ink }} />
          <div className="px-4 sm:px-5 py-3.5">
            <Link
              href="/communities"
              className="inline-flex items-center gap-1.5 min-h-[32px] text-xs text-ink-500 hover:text-ink-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> All communities
            </Link>

            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <h1
                className="font-display text-2xl md:text-3xl tracking-[-0.02em]"
                style={{ color: accent.ink }}
              >
                {meta.community.name}
              </h1>
              <span
                className="font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border bg-paper-0"
                style={{ color: kind.ink, borderColor: kind.edge }}
              >
                {meta.community.kind}
              </span>
              {meta.community.archived && (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-500">
                  archived
                </span>
              )}
            </div>
          </div>
        </header>

        {/* overflow-x-hidden because message rows bleed past the content box
            with a negative margin so their hover state reaches the edge.
            Without this the bleed produces a stray horizontal scrollbar. */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <span
                className="inline-grid place-items-center w-14 h-14 rounded-full mb-4"
                style={{ backgroundColor: accent.wash, color: accent.ink }}
              >
                <Send className="h-5 w-5" aria-hidden />
              </span>
              <p className="text-ink-900 font-medium">Nothing here yet</p>
              <p className="mt-1 text-sm text-text-muted">Say the first thing.</p>
            </div>
          ) : (
            <MessageList messages={messages} />
          )}
          <div ref={endRef} />
        </div>

        {/* Sits above the composer rather than in a separate screen: a
            moderator is already here reading, and a request queue behind
            another click is a request queue nobody clears. */}
        <JoinRequests slug={slug} canModerate={Boolean(meta?.canModerate)} />

        <footer className="shrink-0 pt-3 pb-2">
          {meta.canPost ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="flex items-end gap-2 rounded-[var(--r-lg)] border border-rule bg-paper-0 p-2 focus-within:border-ink-300 transition-colors"
            >
              <label htmlFor="draft" className="sr-only">
                Message {meta.community.name}
              </label>
              <textarea
                id="draft"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends, Shift+Enter breaks the line — the convention
                  // every chat app has trained people on.
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                maxLength={4000}
                placeholder={`Message ${meta.community.name}`}
                className="flex-1 min-h-[40px] max-h-40 resize-y bg-transparent px-2 py-2 text-ink-900 placeholder:text-ink-300 focus:outline-none"
              />
              <Button
                type="submit"
                className="min-h-[44px] min-w-[44px] shrink-0"
                loading={send.isPending}
                disabled={draft.trim().length === 0}
              >
                <Send className="h-4 w-4" aria-hidden />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          ) : (
            <p className="flex items-center gap-2 min-h-[44px] px-3 text-sm text-text-secondary rounded-[var(--r-lg)] border border-rule bg-paper-1">
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              {meta.postBlockedMessage}
            </p>
          )}

          {/* Stated plainly. The product does not claim encryption it does not
              have, and students deserve to know who can read this. */}
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-300">
            Not end-to-end encrypted · moderators and admins can read this room
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
