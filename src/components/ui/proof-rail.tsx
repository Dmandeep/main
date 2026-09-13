"use client"

import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "danger" | "info" | "outline" | "cyan" | "gold" | "ember"

export interface ProofRailItem {
  title: string
  type: string
  time: string
  detail?: string
  badge?: BadgeVariant
  icon?: React.ElementType
  owner?: string
}

interface ProofRailProps {
  items: ProofRailItem[]
  title?: string
  subtitle?: string
  viewHref?: string
  viewLabel?: string
  className?: string
  cardClassName?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function ProofRail({
  items,
  title = "Live Proof Rail",
  subtitle = "Recent activity from builders",
  viewHref = "/wall",
  viewLabel = "View Proof Wall",
  className,
  cardClassName,
  emptyTitle = "No recent proof",
  emptyDescription = "Activity will appear here once teams start shipping.",
}: ProofRailProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge variant="cyan">{title}</Badge>
          <span className="text-sm text-text-secondary">{subtitle}</span>
        </div>
        {viewHref && (
          <Link href={viewHref} className="text-xs font-semibold text-text-muted hover:text-text-secondary transition-colors">
            {viewLabel}
          </Link>
        )}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.length === 0 ? (
          <Card variant="glass" className={cn("min-w-[240px] p-4", cardClassName)}>
            <div className="text-sm font-semibold text-text-primary">{emptyTitle}</div>
            <p className="text-xs text-text-muted mt-2">{emptyDescription}</p>
          </Card>
        ) : (
          items.map((item) => {
            const Icon = item.icon
            const metaLeft = item.owner ? `by ${item.owner}` : ""

            return (
              <Card key={`${item.title}-${item.time}`} variant="glass" className={cn("min-w-[240px] p-4", cardClassName)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-paper-2 border border-rule flex items-center justify-center">
                    {Icon ? <Icon className="h-4 w-4 text-stamp-verified" /> : <span className="h-2 w-2 rounded-full bg-ink-900" />}
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold">{item.type}</div>
                    <div className="text-sm font-semibold text-text-primary line-clamp-1">{item.title}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  {metaLeft ? <span className="text-xs text-text-muted">{metaLeft}</span> : <span />}
                  <span className="text-xs text-text-muted">{item.time}</span>
                </div>
                {item.detail && (
                  <div className="mt-3">
                    <Badge variant={item.badge || "secondary"} className="text-[10px]">
                      {item.detail}
                    </Badge>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}