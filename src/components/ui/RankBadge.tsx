"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RankTier } from "@/types";

interface RankBadgeProps {
  tier: RankTier;
  className?: string;
}

const tierConfig: Record<RankTier, { color: string; label: string }> = {
  Bronze: { color: "bg-amber-950/10 text-amber-700 border-amber-900/20", label: "Bronze" },
  Silver: { color: "bg-slate-400/10 text-slate-400 border-slate-400/20", label: "Silver" },
  Gold: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", label: "Gold" },
  Platinum: { color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", label: "Platinum" },
  Elite: { color: "bg-purple-500/20 text-purple-400 border-purple-500/40 relative overflow-hidden", label: "Elite" },
};

export function RankBadge({ tier, className }: RankBadgeProps) {
  const config = tierConfig[tier] || tierConfig.Bronze;

  return (
    <div
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border",
        config.color,
        className
      )}
    >
      {tier === "Elite" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent skew-x-[-20deg]"
          initial={{ x: "-150%" }}
          animate={{ x: "150%" }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 1 }}
        />
      )}
      <span className="relative z-10">{config.label}</span>
    </div>
  );
}
