"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
  label?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, icon, label, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-text-primary mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full h-10 rounded-[var(--radius-md)] border bg-paper-1/80 backdrop-blur-sm px-3 text-sm text-text-primary placeholder:text-text-muted/60 transition-all duration-[var(--d-component)] ease-[var(--ease-out)]",
              "focus:outline-none focus:ring-2 focus:ring-ink-900/20 focus:border-ink-900",
              "hover:border-ink-500",
              icon && "pl-10",
              error
                ? "border-stamp-rejected focus:ring-stamp-rejected/20 focus:border-stamp-rejected"
                : "border-rule",
              className
            )}
            {...props}
          />
        </div>
        {helperText && (
          <p className={cn("mt-1.5 text-xs", error ? "text-stamp-rejected" : "text-text-muted")}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
