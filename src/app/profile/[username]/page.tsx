"use client";

import { useState, useEffect, use } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RankBadge } from "@/components/ui/RankBadge";
import { PointsCounter } from "@/components/ui/PointsCounter";
import { IdeaCard } from "@/components/ui/IdeaCard";
import { CORE_TRACKS } from "@/types";
import { GitBranch, MapPin, Calendar, Code2, ArrowLeft, Lightbulb, Users } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { ConnectedAccounts } from "@/components/profile/connected-accounts";
import { ProfileTags } from "@/components/profile/profile-tags";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data: session } = useSession();
  const isOwnProfile = session?.user?.username?.toLowerCase() === username.toLowerCase();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then(r => r.json())
      .then(d => setProfile(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [username]);

  const getTrackLabel = (slug: string) => CORE_TRACKS.find(t => t.slug === slug)?.label ?? slug;

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-48 rounded-[var(--radius-xl)]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto text-center py-20">
          <h2 className="text-2xl font-bold text-text-primary mb-2 font-display">User not found</h2>
          <p className="text-text-secondary mb-6">This profile doesn&apos;t exist.</p>
          <Link href="/feed"><Button variant="gradient">Back to the feed</Button></Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto pb-20">
        <Link href="/feed" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        {isOwnProfile && (
          <div className="mb-6 flex justify-end">
            <Link href="/profile/edit">
              <Button variant="secondary">Edit profile</Button>
            </Link>
          </div>
        )}

        {/* Gamified Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card variant="spotlight" className="p-8 mb-8 overflow-hidden relative">
            {/* Background accent based on rank */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
              <Avatar name={profile.name} tier={profile.rankTier} size="xl" className="w-32 h-32 text-4xl" />
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
                  <h1 className="text-3xl md:text-4xl font-bold text-text-primary font-display">{profile.name}</h1>
                  <RankBadge tier={profile.rankTier} />
                </div>
                <p className="text-lg text-brand-secondary font-bold mb-4">@{profile.username}</p>
                
                {profile.bio && <p className="text-sm text-text-secondary mb-6 leading-relaxed max-w-2xl mx-auto md:mx-0">{profile.bio}</p>}
                
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs text-text-muted">
                  <Badge variant="outline" className="capitalize border-ink-300 text-text-secondary bg-surface-overlay">{profile.role}</Badge>
                  {profile.primaryTrack && <span className="flex items-center gap-1"><Code2 className="h-4 w-4" />{getTrackLabel(profile.primaryTrack)}</span>}
                  {profile.branch && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{profile.branch}{profile.year ? `, Year ${profile.year}` : ""}</span>}
                  <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Joined {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                  {profile.githubUsername && (
                    <a href={`https://github.com/${profile.githubUsername}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text-primary transition-colors">
                      <GitBranch className="h-4 w-4" />@{profile.githubUsername}
                    </a>
                  )}
                </div>
              </div>

              {/* Points Gamification Box */}
              <div className="flex flex-col items-center justify-center p-6 rounded-[var(--radius-xl)] bg-surface-raised border border-rule shadow-xl min-w-[140px]">
                <PointsCounter value={profile.points} className="text-4xl md:text-5xl font-bold text-brand-primary font-display" />
                <div className="text-xs text-text-muted uppercase tracking-widest font-bold mt-2">Total Points</div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Tags and accounts elsewhere.
            These replaced two cards fed by `profile.skills` and
            `profile.interests`, which the API has always returned empty — so
            they rendered "No skills listed yet." on every profile in the
            product. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ProfileTags tags={profile.tags ?? []} />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <ConnectedAccounts links={profile.links ?? []} />
          </motion.div>
        </div>

        {/* Forged Ideas (Created by user) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary font-display">Forged Ideas</h2>
            <Badge variant="secondary" className="ml-2">{profile.forgedIdeas.length}</Badge>
          </div>
          
          {profile.forgedIdeas.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnimatePresence>
                {profile.forgedIdeas.map((idea) => (
                  <Link href={`/ideas/${idea.slug}`} key={idea._id} className="block h-full">
                    <IdeaCard idea={idea} />
                  </Link>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-rule rounded-[var(--radius-xl)] bg-surface-overlay/50">
              <p className="text-text-secondary">This user hasn&apos;t forged any ideas yet.</p>
            </div>
          )}
        </motion.div>

        {/* Collaborated Ideas */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-secondary/10 text-brand-secondary rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary font-display">Collaborations</h2>
            <Badge variant="secondary" className="ml-2">{profile.collaboratedIdeas.length}</Badge>
          </div>
          
          {profile.collaboratedIdeas.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AnimatePresence>
                {profile.collaboratedIdeas.map((idea) => (
                  <Link href={`/ideas/${idea.slug}`} key={idea._id} className="block h-full">
                    <IdeaCard idea={idea} />
                  </Link>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="p-12 text-center border border-dashed border-rule rounded-[var(--radius-xl)] bg-surface-overlay/50">
              <p className="text-text-secondary">Not collaborating on any ideas yet.</p>
            </div>
          )}
        </motion.div>

      </div>
    </AppShell>
  );
}

// Ensure Button component is available if not imported
import { Button } from "@/components/ui/button";
import type { PublicProfile } from "@/types/api";
