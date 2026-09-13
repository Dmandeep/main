"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
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
      primary: "bg-ink-900 text-paper-0 hover:bg-stamp-verified hover:text-paper-0 transition-colors shadow-sm",
      gradient: "bg-ink-900 text-paper-0 hover:bg-stamp-verified transition-colors shadow-sm",
      secondary: "bg-paper-1 text-ink-900 border border-rule hover:bg-paper-2 hover:border-stamp-verified transition-colors shadow-sm",
      ghost: "text-ink-700 hover:text-ink-900 hover:bg-paper-1 transition-colors",
      danger: "bg-stamp-rejected text-paper-0 hover:opacity-90 shadow-sm",
      outline: "border border-rule text-ink-900 hover:bg-paper-1 hover:border-stamp-verified shadow-sm",
    };

    const sizes = {
      sm: "h-9 px-3 text-xs gap-1.5",
      md: "h-11 px-4 text-sm gap-2",
      lg: "h-12 px-6 text-base gap-2.5",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.04, y: -2 }}
        whileTap={{ scale: 0.95, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...(props as any)}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
