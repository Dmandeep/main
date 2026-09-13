"use client";

import { Card } from "./card";

export function SkeletonCard() {
  return (
    <Card className="flex flex-col h-full overflow-hidden animate-pulse bg-surface-raised border-rule h-[320px]">
      <div className="w-full h-32 bg-surface-overlay border-b border-rule" />
      <div className="p-5 flex flex-col flex-1 gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-3 flex-1">
            <div className="h-5 w-24 bg-surface-overlay rounded-full" />
            <div className="h-6 w-3/4 bg-surface-overlay rounded-md" />
            <div className="h-6 w-1/2 bg-surface-overlay rounded-md" />
          </div>
          <div className="shrink-0 w-10 h-10 rounded-full bg-surface-overlay" />
        </div>
        
        <div className="space-y-2 mt-2">
          <div className="h-4 w-full bg-surface-overlay rounded-md" />
          <div className="h-4 w-5/6 bg-surface-overlay rounded-md" />
        </div>

        <div className="flex gap-2 mt-auto">
          <div className="h-4 w-12 bg-surface-overlay rounded-sm" />
          <div className="h-4 w-16 bg-surface-overlay rounded-sm" />
        </div>

        <div className="pt-4 border-t border-rule flex items-center justify-between">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-surface-overlay border-2 border-surface-raised" />
            <div className="w-8 h-8 rounded-full bg-surface-overlay border-2 border-surface-raised" />
            <div className="w-8 h-8 rounded-full bg-surface-overlay border-2 border-surface-raised" />
          </div>
          <div className="w-20 h-4 bg-surface-overlay rounded-sm" />
        </div>
      </div>
    </Card>
  );
}
