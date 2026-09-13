"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CORE_TRACKS } from "@/types";
import { calculateHealthScore } from "@/lib/health-score";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Lightbulb } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MarkHandoff } from "@/components/marks";

export default function NewIdeaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Set when arriving from the archive's "pick this up". The server checks
  // that it really is an archived project in this department before storing
  // the lineage.
  const revivedFromId = searchParams.get("revive") ?? undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    tagline: "",
    problem: "",
    solution: "",
    track: "",
    tags: [] as string[],
    skillsNeeded: [] as string[],
    githubUrl: "",
    demoUrl: "",
  });

  const [tagInput, setTagInput] = useState("");
  const [skillInput, setSkillInput] = useState("");

  // Must use the same function as POST /api/ideas, or the preview disagrees
  // with the 60-point publish gate the server enforces.
  const health = calculateHealthScore({
    title: form.title,
    tagline: form.tagline,
    problem: form.problem,
    solution: form.solution,
    tags: form.tags,
    track: form.track,
    githubUrl: form.githubUrl || undefined,
    demoUrl: form.demoUrl || undefined,
  });

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(p => ({ ...p, tags: [...p.tags, tag] }));
      setTagInput("");
    }
  };

  const addSkill = () => {
    const skill = skillInput.trim();
    if (skill && !form.skillsNeeded.includes(skill)) {
      setForm(p => ({ ...p, skillsNeeded: [...p.skillsNeeded, skill] }));
      setSkillInput("");
    }
  };

  const handleSubmit = async (status: "draft" | "discovery") => {
    if (status === "discovery" && health < 40) {
      toast.error("Health score must be at least 40 to publish.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, status, revivedFromId }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Failed to create idea");
        return;
      }

      toast.success(status === "draft" ? "Draft saved!" : "Idea published!");
      router.push("/feed");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const healthColor = health >= 70 ? "#2EA86A" : health >= 40 ? "#F2B24B" : "#E5484D";
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (health / 100) * circumference;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <Link href="/feed" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-ink-900 transition-colors mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Feed
        </Link>

        <h1 className="text-3xl font-bold tracking-tight text-text-primary font-display mb-2">
          <Lightbulb className="inline h-8 w-8 text-stamp-verified mr-2" /> New Idea
        </h1>
        <p className="text-text-secondary mb-8">Define the problem, propose a solution, and publish when ready.</p>

        {/* Reviving. Shown so the person filling this in knows they are
            continuing someone's work, not starting fresh — the lineage is
            recorded and displayed on the project afterwards. */}
        {revivedFromId && (
          <div className="mb-8 flex items-start gap-4 rounded-[var(--radius-lg)] border border-rule bg-paper-1 p-5">
            <MarkHandoff className="h-10 w-10 shrink-0 text-stamp-verified" />
            <div>
              <p className="font-display text-lg text-ink-900">You are picking up an archived project</p>
              <p className="mt-1 text-[15px] leading-relaxed text-ink-700">
                Write it in your own words. When you publish, this project records that it
                continues the original, and the archive shows it was picked up.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <Input label="Title" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="A compelling, specific title (min 10 chars)" helperText={`${form.title.length}/120`} />

            <Input
              label="One-line summary"
              value={form.tagline}
              onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
              placeholder="What it is, in one sentence someone can repeat"
              helperText={`${form.tagline.length}/120 · at least 10`}
            />

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Problem Statement</label>
              <textarea
                value={form.problem}
                onChange={e => setForm(p => ({ ...p, problem: e.target.value }))}
                placeholder="Describe the problem clearly. Who has this problem? Why does it matter?"
                rows={4}
                maxLength={600}
                className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1/80 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/40 focus:border-stamp-verified resize-none"
              />
              <p className="mt-1 text-xs text-text-muted">{form.problem.length}/600</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Proposed Solution</label>
              <textarea
                value={form.solution}
                onChange={e => setForm(p => ({ ...p, solution: e.target.value }))}
                placeholder="How will you solve this? What's the approach?"
                rows={4}
                maxLength={600}
                className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1/80 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/40 focus:border-stamp-verified resize-none"
              />
              <p className="mt-1 text-xs text-text-muted">{form.solution.length}/600</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Track</label>
              <div className="grid grid-cols-2 gap-2">
                {CORE_TRACKS.map(t => (
                  <button
                    key={t.slug}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, track: t.slug }))}
                    className={cn(
                      "text-left px-3 py-2 rounded-[var(--radius-md)] border text-sm transition-all cursor-pointer",
                      form.track === t.slug ? "bg-ink-900/10 border-stamp-verified/30 text-stamp-verified" : "bg-paper-1 border-rule text-text-secondary hover:border-ink-300"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Tags</label>
              <div className="flex gap-2 mb-2">
                <Input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="e.g. AI, React" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <Button type="button" variant="secondary" onClick={addTag}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setForm(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }))}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Skills Needed</label>
              <div className="flex gap-2 mb-2">
                <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="e.g. Python, UI/UX" onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                <Button type="button" variant="secondary" onClick={addSkill}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.skillsNeeded.map(s => (
                  <Badge key={s} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setForm(p => ({ ...p, skillsNeeded: p.skillsNeeded.filter(x => x !== s) }))}>
                    {s} ×
                  </Badge>
                ))}
              </div>
            </div>

            <Input label="GitHub URL (optional)" value={form.githubUrl} onChange={e => setForm(p => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/..." />
            <Input label="Demo URL (optional)" value={form.demoUrl} onChange={e => setForm(p => ({ ...p, demoUrl: e.target.value }))} placeholder="https://your-demo.vercel.app" />

            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => handleSubmit("draft")} loading={isSubmitting}>
                Save Draft
              </Button>
              <Button variant="gradient" onClick={() => handleSubmit("discovery")} loading={isSubmitting} disabled={health < 40}>
                <Check className="mr-2 h-4 w-4" /> Publish Idea
              </Button>
            </div>
          </div>

          {/* Health Score Sidebar */}
          <div>
            <Card variant="glass" className="p-6 sticky top-24">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 text-center">Live Health Score</h3>
              <svg viewBox="0 0 100 100" className="w-32 h-32 mx-auto mb-4">
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={healthColor} strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" className="transition-all duration-500" />
                <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="bold" fill={healthColor} fontFamily="var(--font-display)">{health}</text>
              </svg>
              <p className="text-center text-sm text-text-secondary mb-4">{health >= 70 ? "🟢 Healthy" : health >= 40 ? "🟡 Getting There" : "🔴 Needs Work"}</p>
              <div className="space-y-2 text-xs text-text-muted">
                <div className="flex justify-between"><span>Title (10+ chars)</span><span>{form.title.length >= 10 ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>Problem (80+ chars)</span><span>{form.problem.length >= 80 ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>Solution (80+ chars)</span><span>{form.solution.length >= 80 ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>Tags (2+)</span><span>{form.tags.length >= 2 ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>Skills (1+)</span><span>{form.skillsNeeded.length >= 1 ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>GitHub URL</span><span>{form.githubUrl ? "✓" : "○"}</span></div>
                <div className="flex justify-between"><span>Demo URL</span><span>{form.demoUrl ? "✓" : "○"}</span></div>
              </div>
              {health < 40 && (
                <p className="mt-4 text-xs text-[#E5484D] text-center">Score must be ≥40 to publish</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
