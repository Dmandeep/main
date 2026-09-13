"use client";

import { cn } from "@/lib/utils";
import { RANK_COLORS } from "@/types";
import type { RankTier } from "@/types";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  tier?: RankTier;
  className?: string;
}

export function Avatar({ name, src, size = "md", tier, className }: AvatarProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const tierColor = tier ? RANK_COLORS[tier] : "#1FB7A6";

  if (src) {
    return (
      <div
        className={cn(
          "rounded-full overflow-hidden shrink-0",
          sizes[size],
          className
        )}
        style={{ boxShadow: `0 0 0 2px ${tierColor}` }}
      >
        <img src={src} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-ink-900 shrink-0",
        sizes[size],
        className
      )}
      style={{ background: tierColor }}
    >
      {initials}
    </div>
  );
}
