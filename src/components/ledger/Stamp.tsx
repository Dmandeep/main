"use client";

import { Check, Clock, X, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerificationState = "verified" | "pending" | "rejected" | "archived";

const CONFIG = {
  verified: { label: "Verified", Icon: Check, tone: "text-stamp-verified border-stamp-verified/45" },
  pending: { label: "Pending", Icon: Clock, tone: "text-stamp-pending border-stamp-pending/45" },
  rejected: { label: "Rejected", Icon: X, tone: "text-stamp-rejected border-stamp-rejected/45" },
  archived: { label: "Archived", Icon: Archive, tone: "text-stamp-archived border-rule" },
} as const;

export interface StampProps {
  state: VerificationState;
  /** Who verified it and when — rendered for screen readers, shown on hover. */
  attribution?: string;
  /** Plays the 420ms land animation. Only pass this on a fresh transition. */
  landing?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/**
 * The Provenance Stamp.
 *
 * A letterpress-style mark, not a glowing badge. State is never colour alone:
 * every stamp carries a colour, a glyph and a text label, so it survives both
 * colour-blindness and a greyscale print.
 */
export function Stamp({ state, attribution, landing, size = "md", className }: StampProps) {
  const { label, Icon, tone } = CONFIG[state];
  const readable = attribution ? `${label}. ${attribution}` : label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--r-sm)] border border-dashed",
        "font-mono uppercase tracking-[0.08em] font-medium select-none",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]",
        tone,
        landing && "stamp-land",
        className
      )}
      title={attribution}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      <span aria-hidden>{label}</span>
      <span className="sr-only">{readable}</span>
    </span>
  );
}
