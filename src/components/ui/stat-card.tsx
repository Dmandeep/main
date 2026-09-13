"use client"

import { useEffect, useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  suffix?: string;
  prefix?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  animate?: boolean;
  variant?: 'default' | 'accent' | 'success';
  className?: string;
}

function useCountUp(target: number, duration: number = 1200, enabled: boolean = true) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const counted = useRef(false)

  useEffect(() => {
    if (!enabled || counted.current) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          tick()
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration, enabled])

  return { count, ref }
}

export function StatCard({ 
  label, value, icon, suffix = "", prefix = "", 
  trend, trendValue, animate = true, variant = 'default', className 
}: StatCardProps) {
  const numericValue = typeof value === 'number' ? value : parseInt(value) || 0
  const isNumeric = typeof value === 'number' || !isNaN(parseInt(value as string))
  const { count, ref } = useCountUp(numericValue, 1200, animate && isNumeric)

  return (
    <div
      ref={ref}
      className={cn(
        "p-5 rounded-xl border transition-all duration-300 group hover:border-ink-300",
        {
          "border-rule bg-paper-1": variant === 'default',
          "border-stamp-verified/20 bg-ink-900/[0.04]": variant === 'accent',
          "border-green/20 bg-green/[0.04]": variant === 'success',
        },
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          "flex items-center gap-2 text-sm font-medium",
          {
            "text-text-muted": variant === 'default',
            "text-stamp-verified": variant === 'accent',
            "text-green": variant === 'success',
          }
        )}>
          {icon}
          <span>{label}</span>
        </div>
        {trend && trendValue && (
          <span className={cn(
            "text-xs font-semibold px-2 py-0.5 rounded-md",
            trend === 'up' && "text-green bg-green/10",
            trend === 'down' && "text-red bg-red/10",
            trend === 'neutral' && "text-text-muted bg-paper-0/[0.04]"
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </span>
        )}
      </div>
      <span className="text-3xl font-bold text-text-primary tracking-tight">
        {prefix}{animate && isNumeric ? count : value}{suffix}
      </span>
    </div>
  )
}
