"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, Sparkles, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "points";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

// Global state for toasts
let addToastExternal: ((toast: Omit<ToastMessage, "id">) => void) | null = null;

export const toast = {
  success: (title: string, message?: string) => addToastExternal?.({ type: "success", title, message }),
  error: (title: string, message?: string) => addToastExternal?.({ type: "error", title, message }),
  info: (title: string, message?: string) => addToastExternal?.({ type: "info", title, message }),
  points: (title: string, message?: string) => addToastExternal?.({ type: "points", title, message }),
};

export function ToastSystem() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastExternal = (toast: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { ...toast, id }]);
      
      // Auto-dismiss after 4s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };

    return () => {
      addToastExternal = null;
    };
  }, []);

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 md:px-0">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-[var(--radius-md)] bg-paper-1 border border-rule shadow-[var(--e-3)]"
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-brand-success" />}
              {t.type === "error" && <AlertCircle className="w-5 h-5 text-brand-danger" />}
              {t.type === "info" && <Info className="w-5 h-5 text-brand-primary" />}
              {t.type === "points" && <Sparkles className="w-5 h-5 text-brand-secondary animate-pulse" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-text-primary">{t.title}</h4>
              {t.message && <p className="text-xs text-text-secondary mt-0.5">{t.message}</p>}
            </div>
            <button onClick={() => removeToast(t.id)} className="text-text-muted hover:text-text-primary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
