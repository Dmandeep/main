"use client";

import { cn } from "@/lib/utils";

type IdeaStatus = "draft" | "discovery" | "building" | "shipped" | "archived" | "rejected";

interface StatusChipProps {
  status: IdeaStatus;
  className?: string;
}

const statusConfig: Record<IdeaStatus, { color: string; label: string; shadow: string }> = {
  draft: { color: "text-text-muted bg-surface-overlay border-rule", label: "Draft", shadow: "none" },
  discovery: { color: "text-brand-primary bg-brand-primary/10 border-brand-primary/20", label: "Discovery", shadow: "0 0 12px rgba(99, 102, 241, 0.2)" },
  building: { color: "text-brand-warning bg-brand-warning/10 border-brand-warning/20", label: "Building", shadow: "0 0 12px rgba(245, 158, 11, 0.2)" },
  shipped: { color: "text-brand-success bg-brand-success/10 border-brand-success/20", label: "Shipped", shadow: "0 0 12px rgba(16, 185, 129, 0.2)" },
  archived: { color: "text-text-secondary bg-surface-overlay border-rule", label: "Archived", shadow: "none" },
  rejected: { color: "text-brand-danger bg-brand-danger/10 border-brand-danger/20", label: "Rejected", shadow: "0 0 12px rgba(239, 68, 68, 0.2)" },
};

export function StatusChip({ status, className }: StatusChipProps) {
  const config = statusConfig[status];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border",
        config.color,
        className
      )}
      style={{ boxShadow: config.shadow }}
    >
      <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </div>
  );
}
