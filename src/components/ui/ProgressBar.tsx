"use client";

import { cn } from "@/lib/utils";
import type { IdeaStatus } from "@/types";

interface ProgressBarProps {
  currentStatus: IdeaStatus;
  className?: string;
}

const STAGES = ["draft", "discovery", "building", "shipped"] as const;

export function ProgressBar({ currentStatus, className }: ProgressBarProps) {
  // Determine index
  const currentIndex = (STAGES as readonly IdeaStatus[]).indexOf(currentStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : currentStatus === "archived" || currentStatus === "rejected" ? -1 : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between mb-2">
        {STAGES.map((stage, idx) => (
          <span 
            key={stage} 
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest",
              idx <= activeIndex ? "text-brand-primary" : "text-text-muted"
            )}
          >
            {stage}
          </span>
        ))}
      </div>
      <div className="flex h-1.5 gap-1">
        {STAGES.map((stage, idx) => {
          let bgColor = "bg-surface-overlay";
          if (idx <= activeIndex) {
            if (stage === "shipped") bgColor = "bg-brand-success";
            else if (stage === "building") bgColor = "bg-brand-warning";
            else bgColor = "bg-brand-primary";
          }
          if (currentStatus === "rejected") bgColor = "bg-brand-danger";
          if (currentStatus === "archived") bgColor = "bg-ink-300";

          return (
            <div 
              key={stage} 
              className={cn(
                "flex-1 rounded-full transition-colors duration-500", 
                bgColor
              )} 
            />
          );
        })}
      </div>
    </div>
  );
}
