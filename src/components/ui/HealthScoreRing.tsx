"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HealthScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function HealthScoreRing({ score, size = 48, strokeWidth = 4, className }: HealthScoreRingProps) {
  const getScoreColor = (s: number) => {
    if (s < 40) return "var(--brand-danger)";
    if (s < 60) return "var(--brand-warning)";
    if (s < 80) return "var(--brand-primary)";
    return "var(--brand-success)";
  };

  const color = getScoreColor(score);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--surface-overlay)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          strokeLinecap="round"
        />
      </svg>
      <div 
        className="absolute flex items-center justify-center font-display font-bold"
        style={{ fontSize: size * 0.35, color }}
      >
        {score}
      </div>
    </div>
  );
}
