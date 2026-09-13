"use client";

import { motion } from "framer-motion";
import { StatusChip } from "./StatusChip";
import { HealthScoreRing } from "./HealthScoreRing";
import { CollaboratorStack } from "./CollaboratorStack";
import { Badge } from "./badge";
import { Card } from "./card";
import { cn } from "@/lib/utils";
import type { Collaborator } from "./CollaboratorStack";
import type { IdeaStatus } from "@/types";

interface IdeaCardProps {
  idea: {
    _id: string;
    title: string;
    problem: string;
    status: IdeaStatus;
    healthScore: number;
    tags: string[];
    collaborators: Collaborator[];
    coverImage?: string;
  };
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function IdeaCard({ idea, showActions = true, compact = false, className }: IdeaCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "0 8px 32px rgba(99,102,241,0.15)" }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn("h-full w-full", className)}
    >
      <Card variant="spotlight" className="flex flex-col h-full overflow-hidden group">
        {idea.coverImage && !compact && (
          <div className="w-full h-32 overflow-hidden bg-surface-overlay border-b border-rule">
            <img src={idea.coverImage} alt={idea.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
        )}
        <div className="p-5 flex flex-col flex-1 gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <StatusChip status={idea.status} />
              <h3 className="text-lg font-display font-bold text-text-primary leading-tight line-clamp-2">
                {idea.title}
              </h3>
            </div>
            <div className="shrink-0">
              <HealthScoreRing 
                score={idea.healthScore} 
                size={40} 
                strokeWidth={3} 
                className={idea.healthScore < 60 ? "animate-pulse" : ""} 
              />
            </div>
          </div>
          
          {!compact && (
            <p className="text-sm text-text-secondary line-clamp-2 leading-relaxed">
              {idea.problem}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-auto">
            {idea.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0.5">{tag}</Badge>
            ))}
            {idea.tags.length > 3 && (
              <span className="text-[10px] text-text-muted font-bold self-center ml-1">+{idea.tags.length - 3}</span>
            )}
          </div>

          <div className="pt-4 border-t border-rule flex items-center justify-between">
            <CollaboratorStack collaborators={idea.collaborators} max={4} />
            {showActions && (
              <div className="text-xs font-bold text-brand-primary group-hover:text-brand-accent transition-colors">
                View Details &rarr;
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
