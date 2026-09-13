"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={cn(
                "w-full max-w-lg bg-surface-raised border border-rule rounded-[var(--radius-xl)] shadow-2xl pointer-events-auto overflow-hidden",
                className
              )}
            >
              {title && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-rule">
                  <h3 className="text-lg font-display font-bold text-text-primary">{title}</h3>
                  <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-overlay cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {!title && (
                <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors p-1 rounded-md hover:bg-surface-overlay cursor-pointer z-10">
                  <X className="w-5 h-5" />
                </button>
              )}
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
