"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { RankTier } from "@/types";

export interface Collaborator {
  _id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  rankTier?: RankTier;
}

interface CollaboratorStackProps {
  collaborators: Collaborator[];
  max?: number;
  className?: string;
}

export function CollaboratorStack({ collaborators, max = 5, className }: CollaboratorStackProps) {
  const visible = collaborators.slice(0, max);
  const overflow = collaborators.length > max ? collaborators.length - max : 0;

  return (
    <div className={cn("flex items-center group", className)}>
      <div className="flex -space-x-2">
        {visible.map((c, i) => (
          <motion.div
            key={c._id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative z-10 hover:z-20 transition-transform hover:-translate-y-1"
            title={c.name}
          >
            <div className="ring-2 ring-surface-base rounded-full overflow-hidden">
              <Avatar name={c.name} size="sm" tier={c.rankTier} />
            </div>
          </motion.div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="relative z-10 -ml-2 ring-2 ring-surface-base flex items-center justify-center w-8 h-8 rounded-full bg-surface-overlay text-text-secondary text-[10px] font-bold border border-rule">
          +{overflow}
        </div>
      )}
    </div>
  );
}
