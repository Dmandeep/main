"use client";

import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, max = 100, showLabel = true, className, size = "sm" }: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const getColor = () => {
    if (percentage < 40) return "bg-[#E5484D]";
    if (percentage < 70) return "bg-[#F2B24B]";
    return "bg-[#2EA86A]";
  };

  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-text-muted font-medium">Health</span>
          <span className="text-text-primary font-bold">{value}/{max}</span>
        </div>
      )}
      <div className={cn("w-full rounded-full bg-paper-2 overflow-hidden", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
