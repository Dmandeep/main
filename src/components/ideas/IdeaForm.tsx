"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { ideaSchema, IdeaFormValues } from "@/lib/validations/idea";
import { calculateHealthScore, IdeaDataForScore } from "@/lib/health-score";
import { Button } from "@/components/ui/button";
import { HealthScoreRing } from "@/components/ui/HealthScoreRing";
import { toast } from "@/components/ui/ToastSystem";
import { errorMessage } from "@/lib/utils";

interface IdeaFormProps {
  initialData?: IdeaFormValues & { status?: string };
  isEdit?: boolean;
}

export function IdeaForm({ initialData, isEdit }: IdeaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaSchema),
    defaultValues: initialData || {
      title: "",
      tagline: "",
      problem: "",
      solution: "",
      track: "",
      tags: [],
      skillsNeeded: [],
      coverImage: "",
      githubUrl: "",
      demoUrl: "",
    },
  });

  const formValues = watch();
  const [healthScore, setHealthScore] = useState(0);

  useEffect(() => {
    const scoreData: IdeaDataForScore = {
      title: formValues.title,
      tagline: formValues.tagline,
      problem: formValues.problem,
      solution: formValues.solution,
      tags: formValues.tags,
      track: formValues.track,
      coverImage: formValues.coverImage,
      githubUrl: formValues.githubUrl,
      demoUrl: formValues.demoUrl,
      collaboratorsCount: 1, 
    };
    setHealthScore(calculateHealthScore(scoreData));
  }, [formValues]);

  const onSubmit = async (data: IdeaFormValues, intent: "draft" | "discovery") => {
    if (intent === "discovery" && healthScore < 60) {
      toast.error("Health Score Too Low", "You need at least 60 points to publish to discovery.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/ideas", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: intent }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to save idea");

      toast.success(
        intent === "discovery" ? "Idea Published!" : "Draft Saved",
        intent === "discovery" ? "Your idea is now live." : "You can continue editing later."
      );
      router.push(`/ideas/${result.data.slug}`);
    } catch (error) {
      toast.error("Error", errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-surface-raised border border-rule rounded-[var(--radius-xl)] shadow-lg sticky top-4 z-40">
        <div>
          <h2 className="text-xl font-display font-bold text-text-primary">
            {isEdit ? "Edit Idea" : "Forge New Idea"}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Build your health score to unlock publishing.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-text-muted uppercase tracking-widest">Score</span>
            <HealthScoreRing score={healthScore} size={50} strokeWidth={4} />
          </div>
          <div className="flex items-center gap-3">
            <Button 
              type="button" 
              variant="secondary" 
              disabled={loading}
              onClick={handleSubmit((d) => onSubmit(d, "draft"))}
            >
              Save Draft
            </Button>
            <Button 
              type="button" 
              variant={healthScore >= 60 ? "primary" : "ghost"}
              disabled={loading || healthScore < 60}
              className={healthScore >= 60 ? undefined : "opacity-50"}
              onClick={handleSubmit((d) => onSubmit(d, "discovery"))}
            >
              Publish
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">Title</label>
            <input 
              {...register("title")}
              className="w-full bg-surface-overlay border border-rule rounded-md px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-colors"
              placeholder="e.g. IdeaSpace Platform"
            />
            {errors.title && <p className="text-brand-danger text-xs">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">Tagline</label>
            <input 
              {...register("tagline")}
              className="w-full bg-surface-overlay border border-rule rounded-md px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-colors"
              placeholder="Short, catchy description"
            />
            {errors.tagline && <p className="text-brand-danger text-xs">{errors.tagline.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">Track / Category</label>
            <select 
              {...register("track")}
              className="w-full bg-surface-overlay border border-rule rounded-md px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-colors"
            >
              <option value="">Select a track...</option>
              <option value="ai">AI & Intelligent Systems</option>
              <option value="web3">Web3 & Decentralization</option>
              <option value="sustainability">Sustainability</option>
              <option value="fintech">FinTech</option>
              <option value="edtech">EdTech</option>
            </select>
            {errors.track && <p className="text-brand-danger text-xs">{errors.track.message}</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">The Problem</label>
            <textarea 
              {...register("problem")}
              rows={4}
              className="w-full bg-surface-overlay border border-rule rounded-md px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-colors resize-none"
              placeholder="What specific problem are you solving?"
            />
            {errors.problem && <p className="text-brand-danger text-xs">{errors.problem.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-text-primary">The Solution</label>
            <textarea 
              {...register("solution")}
              rows={4}
              className="w-full bg-surface-overlay border border-rule rounded-md px-4 py-2.5 text-text-primary focus:border-brand-primary outline-none transition-colors resize-none"
              placeholder="How does your idea solve this problem?"
            />
            {errors.solution && <p className="text-brand-danger text-xs">{errors.solution.message}</p>}
          </div>
        </div>
      </div>
      
      {/* Additional fields like Tags, Links, Cover image can be placed here */}
      <div className="space-y-2 p-6 bg-surface-overlay rounded-[var(--radius-lg)] border border-rule">
         <h3 className="text-sm font-bold text-text-primary mb-4">Bonus Points (Optional)</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-text-muted">GitHub Repository URL</label>
              <input 
                {...register("githubUrl")}
                className="w-full bg-surface-base border border-rule rounded-md px-3 py-2 mt-1 text-sm text-text-primary focus:border-brand-primary outline-none"
                placeholder="https://github.com/..."
              />
              {errors.githubUrl && <p className="text-brand-danger text-xs mt-1">{errors.githubUrl.message}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-text-muted">Demo URL</label>
              <input 
                {...register("demoUrl")}
                className="w-full bg-surface-base border border-rule rounded-md px-3 py-2 mt-1 text-sm text-text-primary focus:border-brand-primary outline-none"
                placeholder="https://..."
              />
              {errors.demoUrl && <p className="text-brand-danger text-xs mt-1">{errors.demoUrl.message}</p>}
            </div>
         </div>
      </div>
    </form>
  );
}
