"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  initialCount?: number;
  className?: string;
}

export function NotificationBell({ initialCount = 0, className }: NotificationBellProps) {
  const [count, setCount] = useState(initialCount);
  const [isRinging, setIsRinging] = useState(false);

  // Expose a way to trigger ring externally if needed (e.g. via an event bus or context)
  useEffect(() => {
    const handleNewNotification = () => {
      setCount((c) => c + 1);
      setIsRinging(true);
      setTimeout(() => setIsRinging(false), 1000);
    };
    window.addEventListener("new-notification", handleNewNotification);
    return () => window.removeEventListener("new-notification", handleNewNotification);
  }, []);

  return (
    <button className={cn("relative p-2 rounded-full hover:bg-surface-overlay transition-colors cursor-pointer", className)}>
      <motion.div
        animate={isRinging ? { rotate: [0, -15, 15, -15, 15, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        <Bell className="w-5 h-5 text-text-secondary hover:text-text-primary transition-colors" />
      </motion.div>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-1 right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-brand-danger text-ink-900 text-[9px] font-bold ring-2 ring-surface-base"
          >
            {count > 99 ? "99+" : count}
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}
