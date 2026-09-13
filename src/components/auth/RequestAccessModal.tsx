"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ShieldCheck, Mail, User, BookOpen } from "lucide-react";
import { toast } from "@/components/ui/ToastSystem";

interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
  defaultName?: string;
}

export function RequestAccessModal({ isOpen, onClose, defaultEmail = "", defaultName = "" }: RequestAccessModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [rollNumber, setRollNumber] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, name, rollNumber, reason }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit request");
      }

      toast.success("Request Submitted", "Your access request has been sent to the admins.");
      onClose();
    } catch (err: any) {
      toast.error("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-paper-0 border border-rule rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 glass-panel"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-stamp-verified" />
                <h3 className="font-bold text-text-primary font-display text-xl">Request Access</h3>
              </div>
              <button onClick={onClose} className="text-text-muted hover:text-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              IdeaSpace is currently restricted. If you are a non-college user or your email wasn't recognized, please request access.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <Input
                label="Full Name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                icon={<User className="h-4 w-4" />}
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                icon={<Mail className="h-4 w-4" />}
              />
              <Input
                label="College ID / Roll Number (Optional)"
                placeholder="e.g. 21KD1A0501"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                icon={<BookOpen className="h-4 w-4" />}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-text-primary mb-1.5 block">
                  Reason for Access
                </label>
                <textarea
                  className="w-full bg-paper-1/80 backdrop-blur-sm border border-rule rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/20 focus:border-ink-900 hover:border-ink-500 transition-all resize-none min-h-[80px]"
                  placeholder="Why do you need access to IdeaSpace?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={loading} className="font-bold px-6">
                  {loading ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
