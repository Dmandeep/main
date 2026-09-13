"use client";

import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * `cyan`, `gold` and `ember` are retained as aliases for existing call sites.
   * The Ledger palette has one colour per state and no decorative colours.
   */
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "cyan"
    | "gold"
    | "ember";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "bg-paper-2 text-ink-700 border-rule",
    secondary: "bg-paper-2 text-ink-700 border-rule",
    outline: "bg-transparent text-ink-500 border-rule",
    info: "bg-paper-2 text-ink-900 border-ink-300",
    success: "bg-transparent text-stamp-verified border-stamp-verified/40",
    warning: "bg-transparent text-stamp-pending border-stamp-pending/40",
    danger: "bg-transparent text-stamp-rejected border-stamp-rejected/40",
    cyan: "bg-paper-2 text-ink-700 border-rule",
    gold: "bg-transparent text-stamp-pending border-stamp-pending/40",
    ember: "bg-transparent text-stamp-rejected border-stamp-rejected/40",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--r-sm)] border",
        "font-mono text-[11px] font-medium uppercase tracking-[0.06em]",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
