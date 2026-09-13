"use client"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface EvidenceWallItem {
  title: string
  proofType: string
  outcome: string
  owner: string
  time: string
  icon?: React.ElementType
}

interface EvidenceWallProps {
  items: EvidenceWallItem[]
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}

export function EvidenceWall({
  items,
  className,
  emptyTitle = "No proof yet",
  emptyDescription = "Evidence appears here as teams ship demos, repos, and postmortems.",
}: EvidenceWallProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", className)}>
      {items.length === 0 ? (
        <Card variant="glass" className="p-6 md:col-span-2 lg:col-span-3 text-center">
          <div className="text-sm font-semibold text-text-primary">{emptyTitle}</div>
          <p className="text-xs text-text-muted mt-2">{emptyDescription}</p>
        </Card>
      ) : (
        items.map((item) => {
          const Icon = item.icon

          return (
            <Card key={`${item.title}-${item.time}`} variant="spotlight" className="p-6 h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-paper-2 border border-rule flex items-center justify-center">
                    {Icon ? <Icon className="h-4 w-4 text-stamp-verified" /> : <span className="h-2 w-2 rounded-full bg-ink-900" />}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-[10px]">{item.proofType}</Badge>
                    <div className="text-lg font-bold text-text-primary line-clamp-1 mt-2">{item.title}</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {item.time}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary mt-4 leading-relaxed">{item.outcome}</p>
              <div className="text-xs text-text-muted mt-4">by {item.owner}</div>
            </Card>
          )
        })
      )}
    </div>
  )
}