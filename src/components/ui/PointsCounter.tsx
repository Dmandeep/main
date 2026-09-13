"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

interface PointsCounterProps {
  value: number;
  className?: string;
  prefix?: string;
}

export function PointsCounter({ value, className, prefix = "" }: PointsCounterProps) {
  const springValue = useSpring(0, { stiffness: 300, damping: 30 });
  const displayValue = useTransform(springValue, (current) => Math.round(current));
  
  // The spring starts at 0 so the server-rendered markup and the first client
  // render agree; the animation to `value` runs after hydration.
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <span className={cn("font-display font-bold tabular-nums", className)}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
    </span>
  );
}
