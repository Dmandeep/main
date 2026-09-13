"use client";

import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * `glass` and `spotlight` are retained as aliases so existing call sites keep
   * compiling. There is no glassmorphism and no spotlight gradient in the
   * Ledger system — both now render as flat paper with a hairline rule.
   */
  variant?: "default" | "raised" | "sunken" | "elevated" | "glass" | "spotlight";
}

export function Card({ className, variant = "default", children, ...props }: CardProps) {
  const variants: Record<NonNullable<CardProps["variant"]>, string> = {
    default: "bg-paper-1 border border-rule transition-colors hover:border-stamp-verified",
    raised: "bg-paper-1 border border-rule transition-colors hover:border-stamp-verified",
    glass: "bg-paper-1 border border-rule hover:border-stamp-verified",
    spotlight: "bg-paper-1 border border-rule hover:border-stamp-verified transition-colors",
    sunken: "bg-paper-2 border border-rule-soft",
    elevated: "bg-paper-1 border border-rule transition-colors hover:border-stamp-verified",
  };

  return (
    <div
      className={cn("rounded-[var(--r-lg)]", variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
