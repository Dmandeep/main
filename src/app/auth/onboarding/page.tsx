"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { CORE_TRACKS } from "@/types";
import { cn } from "@/lib/utils";

const SKILL_OPTIONS = ["TypeScript", "React", "Next.js", "Node.js", "Python", "Java", "C++", "Rust", "Go", "Flutter", "React Native", "TensorFlow", "PyTorch", "MongoDB", "PostgreSQL", "Docker", "AWS", "Figma", "UI/UX", "DevOps"];
const INTEREST_OPTIONS = ["AI & ML", "Web Dev", "Mobile", "Cloud", "Cybersecurity", "IoT", "Blockchain", "Data Science", "Design", "Research", "Open Source", "Competitive Programming"];

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: (session?.user?.name as string) ?? "",
    username: "",
    bio: "",
    skills: [] as string[],
    interests: [] as string[],
    primaryTrack: "",
    secondaryTracks: [] as string[],
    branch: "",
    year: undefined as number | undefined,
  });

  const toggleItem = (key: "skills" | "interests" | "secondaryTracks", value: string) => {
    setFormData(prev => {
      const arr = prev[key];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter(v => v !== value) };
      }
      if (key === "secondaryTracks" && arr.length >= 2) return prev;
      return { ...prev, [key]: [...arr, value] };
    });
  };

  async function handleComplete() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/users/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || "Onboarding failed");
        return;
      }

      await update({ isOnboarded: true, username: formData.username });
      toast.success("Profile set up! Welcome to IdeaSpace.");
      router.push("/feed");
      router.refresh();
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }

  const steps = [
    {
      title: "Tell us about yourself",
      subtitle: "Basic info to get you started",
      content: (
        <div className="space-y-4">
          <Input label="Full Name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Harshith Kumar" />
          <Input label="Username" value={formData.username} onChange={e => setFormData(p => ({ ...p, username: e.target.value.toLowerCase() }))} placeholder="harshith" helperText="Lowercase, no spaces. This is your public handle." />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Bio</label>
            <textarea
              value={formData.bio}
              onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
              placeholder="What drives you? What are you building?"
              maxLength={300}
              rows={3}
              className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1/80 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/40 focus:border-stamp-verified resize-none"
            />
            <p className="mt-1 text-xs text-text-muted">{formData.bio.length}/300</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Branch" value={formData.branch ?? ""} onChange={e => setFormData(p => ({ ...p, branch: e.target.value }))} placeholder="CSE" />
            <Input label="Year" type="number" value={formData.year ?? ""} onChange={e => setFormData(p => ({ ...p, year: parseInt(e.target.value) || undefined }))} placeholder="3" />
          </div>
        </div>
      ),
      isValid: formData.name.length >= 2 && formData.username.length >= 3,
    },
    {
      title: "Your skills & interests",
      subtitle: "Help us match you with the right projects",
      content: (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">Skills <span className="text-text-muted">(pick at least 1)</span></label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map(skill => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleItem("skills", skill)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                    formData.skills.includes(skill) ? "bg-ink-900/15 text-stamp-verified border-stamp-verified/30" : "bg-paper-2 text-text-secondary border-rule hover:border-ink-300"
                  )}
                >
                  {formData.skills.includes(skill) && <Check className="inline h-3 w-3 mr-1" />}
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">Interests <span className="text-text-muted">(pick at least 1)</span></label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleItem("interests", interest)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer",
                    formData.interests.includes(interest) ? "bg-ink-900/15 text-stamp-verified border-stamp-verified/30" : "bg-paper-2 text-text-secondary border-rule hover:border-ink-300"
                  )}
                >
                  {formData.interests.includes(interest) && <Check className="inline h-3 w-3 mr-1" />}
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
      isValid: formData.skills.length >= 1 && formData.interests.length >= 1,
    },
    {
      title: "Choose your track",
      subtitle: "Your primary track determines your feed and matching",
      content: (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-text-primary mb-3">Primary Track <span className="text-text-muted">(required)</span></label>
          <div className="grid grid-cols-1 gap-2">
            {CORE_TRACKS.map(track => (
              <button
                key={track.slug}
                type="button"
                onClick={() => setFormData(p => ({ ...p, primaryTrack: track.slug }))}
                className={cn(
                  "text-left px-4 py-3 rounded-[var(--radius-md)] border text-sm font-medium transition-all cursor-pointer",
                  formData.primaryTrack === track.slug ? "bg-ink-900/10 border-stamp-verified/30 text-stamp-verified" : "bg-paper-1 border-rule text-text-secondary hover:border-ink-300"
                )}
              >
                {track.label}
              </button>
            ))}
          </div>
        </div>
      ),
      isValid: formData.primaryTrack.length > 0,
    },
  ];

  return (
    <div className="flex min-h-screen relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-ink-900/[0.06] to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 md:px-24 relative z-10">
        <div className="max-w-[520px] w-full mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 font-display font-bold">
            <div className="w-8 h-8 rounded-[var(--r-sm)] bg-ink-900 flex items-center justify-center">
              <Zap className="h-4 w-4 text-paper-0" />
            </div>
            IdeaSpace
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((_, i) => (
              <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-ink-900" : "bg-paper-2")} />
            ))}
          </div>

          {/* Step content */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-ink-900 mb-1 font-display">{steps[step].title}</h1>
            <p className="text-text-secondary text-sm">{steps[step].subtitle}</p>
          </div>

          <div className="mb-8">{steps[step].content}</div>

          {/* Navigation */}
          <div className="flex justify-between">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
            ) : <div />}
            {step < steps.length - 1 ? (
              <Button variant="gradient" onClick={() => setStep(step + 1)} disabled={!steps[step].isValid}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button variant="gradient" onClick={handleComplete} loading={isLoading} disabled={!steps[step].isValid}>
                Complete Setup <Check className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
