"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/ToastSystem";
import { ProfileTags } from "@/components/profile/profile-tags";
import type { ProfileTagView } from "@/components/profile/profile-tags";
import {
  PLATFORM_KEYS,
  platformLabel,
  platformStatHint,
  showsAsVerified,
} from "@/lib/profile/links";
import { errorMessage } from "@/lib/utils";
import type { PublicProfile } from "@/types/api";

/**
 * Editing your own profile.
 *
 * Stats are typed in by the student and shown as their words, not fetched and
 * rendered as authoritative. Scraping a LeetCode count and presenting it as a
 * number the platform stands behind would be inventing verification — and the
 * page says which links are proven and which are claims, so it has to be
 * honest about the difference here too.
 */

interface LinkDraft {
  handle: string;
  statLabel: string;
  statValue: string;
}

export default function ProfileEditPage() {
  const { data: session } = useSession();
  const username = session?.user?.username;
  const queryClient = useQueryClient();
  const profileKey = ["profile", username];

  const [drafts, setDrafts] = useState<Record<string, LinkDraft>>({});
  const [newTag, setNewTag] = useState("");

  const { data: profile, isPending } = useQuery<PublicProfile>({
    queryKey: profileKey,
    enabled: Boolean(username),
    queryFn: async () => {
      const res = await fetch(`/api/users/${username}`);
      if (!res.ok) throw new Error("Failed to load your profile");
      return (await res.json()).data;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: profileKey });

  const saveLink = useMutation({
    mutationFn: async (vars: { platform: string } & LinkDraft) => {
      const res = await fetch("/api/profile/links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: vars.platform.toUpperCase(),
          handle: vars.handle,
          statLabel: vars.statLabel || undefined,
          statValue: vars.statValue || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save the link");
      return body.data;
    },
    onSuccess: (_data, vars) => {
      toast.success("Saved", `Your ${platformLabel(vars.platform)} handle is on your profile.`);
      setDrafts((d) => {
        const next = { ...d };
        delete next[vars.platform];
        return next;
      });
      refresh();
    },
    onError: (e) => toast.error("Could not save the link", errorMessage(e)),
  });

  const removeLink = useMutation({
    mutationFn: async (platform: string) => {
      const res = await fetch("/api/profile/links", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.toUpperCase() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not remove the link");
      return body.data;
    },
    onSuccess: () => {
      toast.success("Removed", "That account is no longer on your profile.");
      refresh();
    },
    onError: (e) => toast.error("Could not remove the link", errorMessage(e)),
  });

  const addTag = useMutation({
    mutationFn: async (label: string) => {
      const res = await fetch("/api/profile/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add the tag");
      return body.data;
    },
    onSuccess: () => {
      setNewTag("");
      refresh();
    },
    onError: (e) => toast.error("Could not add the tag", errorMessage(e)),
  });

  const removeTag = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/profile/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not remove the tag");
      return body.data;
    },
    onSuccess: refresh,
    onError: (e) => toast.error("Could not remove the tag", errorMessage(e)),
  });

  const existing = new Map((profile?.links ?? []).map((l) => [l.platform, l]));

  function draftFor(platform: string): LinkDraft {
    const saved = existing.get(platform);
    return (
      drafts[platform] ?? {
        handle: saved?.handle ?? "",
        statLabel: saved?.statLabel ?? "",
        statValue: saved?.statValue ?? "",
      }
    );
  }

  function setDraft(platform: string, patch: Partial<LinkDraft>) {
    setDrafts((d) => ({ ...d, [platform]: { ...draftFor(platform), ...patch } }));
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-24">
        <Link
          href={username ? `/profile/${username}` : "/dashboard"}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to your profile
        </Link>

        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink-900 tracking-[-0.02em]">Your profile</h1>
          <p className="mt-2 text-text-secondary">
            Accounts you add here are shown as claims. Only GitHub can be proven, by signing in
            with it.
          </p>
        </header>

        {isPending || !profile ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        ) : (
          <>
            <Card variant="glass" className="mb-8 p-6">
              <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Your tags
              </h2>

              <ProfileTags
                tags={(profile.tags ?? []) as ProfileTagView[]}
                onRemove={(tag) => removeTag.mutate(tag._id)}
              />

              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newTag.trim()) addTag.mutate(newTag.trim());
                }}
              >
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="backend, embedded, ui…"
                  maxLength={24}
                />
                <Button type="submit" variant="secondary" disabled={addTag.isPending}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </form>
              <p className="mt-2 text-xs text-text-muted">
                Tags you add are marked as chosen by you. Tags for verified work are issued
                automatically and cannot be removed here.
              </p>
            </Card>

            <Card variant="glass" className="p-6">
              <h2 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Accounts elsewhere
              </h2>

              <ul className="space-y-5">
                {PLATFORM_KEYS.map((platform) => {
                  const saved = existing.get(platform);
                  const draft = draftFor(platform);
                  const verified = showsAsVerified(platform, saved?.isVerified ?? false);
                  const changed =
                    draft.handle !== (saved?.handle ?? "") ||
                    draft.statLabel !== (saved?.statLabel ?? "") ||
                    draft.statValue !== (saved?.statValue ?? "");

                  return (
                    <li key={platform} className="border-b border-rule pb-5 last:border-0 last:pb-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-900">
                          {platformLabel(platform)}
                        </span>
                        {verified && (
                          <span className="flex items-center gap-0.5 text-stamp-verified">
                            <ShieldCheck className="h-3 w-3" />
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em]">
                              Verified
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
                        <Input
                          value={draft.handle}
                          onChange={(e) => setDraft(platform, { handle: e.target.value })}
                          placeholder="username or profile link"
                        />
                        <Input
                          value={draft.statLabel}
                          onChange={(e) => setDraft(platform, { statLabel: e.target.value })}
                          placeholder={platformStatHint(platform).split(",")[0]}
                          maxLength={40}
                        />
                        <Input
                          value={draft.statValue}
                          onChange={(e) => setDraft(platform, { statValue: e.target.value })}
                          placeholder="value"
                          maxLength={40}
                        />

                        <div className="flex items-center gap-1">
                          <Button
                            variant="secondary"
                            disabled={!draft.handle.trim() || !changed || saveLink.isPending}
                            onClick={() => saveLink.mutate({ platform, ...draft })}
                          >
                            Save
                          </Button>
                          {saved && (
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${platformLabel(platform)}`}
                              disabled={removeLink.isPending}
                              onClick={() => removeLink.mutate(platform)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
