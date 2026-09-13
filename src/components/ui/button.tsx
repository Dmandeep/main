"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `gradient` is retained only as an alias for `primary` so existing call
   * sites keep compiling. There are no gradients in the Ledger system.
   */
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "gradient";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold press-effect rounded-[var(--r-md)] " +
      "transition-colors duration-[var(--d-micro)] ease-[var(--ease-out)] " +
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 " +
      "disabled:opacity-45 disabled:pointer-events-none cursor-pointer";

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      // Ink on paper. The primary action is the darkest thing on the page.
      primary: "bg-ink-900 text-paper-0 hover:bg-stamp-verified hover:text-paper-0 transition-colors",
      gradient: "bg-ink-900 text-paper-0 hover:bg-stamp-verified transition-colors",
      secondary: "bg-paper-1 text-ink-900 border border-rule hover:bg-paper-2 hover:border-stamp-verified transition-colors",
      ghost: "text-ink-700 hover:text-ink-900 hover:bg-paper-1 transition-colors",
      danger: "bg-stamp-rejected text-paper-0 hover:opacity-90",
      outline: "border border-rule text-ink-900 hover:bg-paper-1 hover:border-stamp-verified",
    };

    // 44px minimum touch target on md and lg; sm is for dense desktop toolbars only.
    const sizes = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-11 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
