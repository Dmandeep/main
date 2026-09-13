"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  CheckCircle2,
  ArrowLeft,
  Send,
  Building2,
  GraduationCap,
  Sparkles,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/ToastSystem";

function RequestAccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const prefilledEmail = searchParams.get("email") || "";
  const prefilledName = searchParams.get("name") || "";

  const [name, setName] = useState(prefilledName);
  const [email, setEmail] = useState(prefilledEmail);
  const [department, setDepartment] = useState("Computer Science & Engineering");
  const [year, setYear] = useState(1);
  const [rollNumber, setRollNumber] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionData, setSubmissionData] = useState<{ email: string; name: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) {
      toast.error("Required fields", "Please provide both your name and email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          department,
          year: Number(year),
          rollNumber: rollNumber || undefined,
          reason: reason || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.alreadyRegistered) {
          toast.success("Account exists", "You are already registered! Please sign in.");
          router.push("/auth/login");
          return;
        }
        if (data.isApproved) {
          toast.success("Approved", "Your access has been approved! You can now log in.");
          router.push("/auth/login");
          return;
        }
        toast.error("Notice", data.error || "Failed to submit request.");
        return;
      }

      setSubmitted(true);
      setSubmissionData({ email, name });
      toast.success("Request submitted", "Your request has been forwarded to the department administrator.");
    } catch {
      toast.error("Network error", "Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-0 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-raised border border-rule mb-4 shadow-lg text-stamp-verified">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary font-display">
            Request Campus Access
          </h1>
          <p className="text-text-secondary mt-2 text-sm max-w-md mx-auto">
            IdeaSpace is restricted to verified campus innovators. If your email was not on a dumped form or roster, request approval from your administrator below.
          </p>
        </div>

        {submitted ? (
          <Card variant="spotlight" className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-success/15 border border-success/30 text-success mx-auto">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-text-primary font-display">
                Access Request Pending Review
              </h2>
              <p className="text-sm text-text-secondary mt-2">
                We recorded your request for <strong className="text-text-primary">{submissionData?.email}</strong>.
              </p>
            </div>

            <div className="bg-paper-1/60 p-4 rounded-xl border border-rule text-left text-xs text-text-secondary space-y-2">
              <div className="flex items-center justify-between">
                <span>Department:</span>
                <span className="font-semibold text-text-primary">{department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Year of Study:</span>
                <span className="font-semibold text-text-primary">Year {year}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <Badge variant="warning" className="text-[10px]">Pending Administrator Approval</Badge>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Once your department administrator approves your request or dumps the corresponding Google Form responses, you will be able to <strong>sign in directly with Google</strong> without any additional steps.
            </p>

            <div className="pt-2">
              <Link href="/auth/login">
                <Button variant="secondary" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" /> Return to Login
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card variant="glass" className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {prefilledEmail && (
                <div className="p-3 bg-paper-1/80 border border-rule rounded-xl flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-[#F2B24B] shrink-0 mt-0.5" />
                  <div className="text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">{prefilledEmail}</span> is not registered yet. Fill in your details below to request access.
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <Input
                  required
                  placeholder="e.g. Harshith Varma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <Input
                  required
                  type="email"
                  placeholder="student@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Department
                  </label>
                  <select
                    className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ink-900/40"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Computer Science & Engineering">CSE</option>
                    <option value="Electronics & Communication">ECE</option>
                    <option value="Electrical & Electronics">EEE</option>
                    <option value="Mechanical Engineering">MECH</option>
                    <option value="Civil Engineering">CIVIL</option>
                    <option value="Information Technology">IT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                    Year of Study
                  </label>
                  <select
                    className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1 px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ink-900/40"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    <option value={1}>1st Year (Freshman)</option>
                    <option value={2}>2nd Year (Sophomore)</option>
                    <option value={3}>3rd Year (Junior)</option>
                    <option value={4}>4th Year (Senior)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Roll Number / Student ID (Optional)
                </label>
                <Input
                  placeholder="e.g. 23B91A0501"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Notes or Reason for Access (Optional)
                </label>
                <textarea
                  className="w-full rounded-[var(--radius-md)] border border-rule bg-paper-1 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/40 resize-none"
                  rows={2}
                  placeholder="e.g. Registered for Hackathon or working on capstone project..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full h-11 font-bold gap-2"
                  disabled={loading}
                >
                  <Send className="h-4 w-4" />
                  {loading ? "Submitting Request..." : "Submit Access Request"}
                </Button>

                <Link href="/auth/login">
                  <Button variant="ghost" className="w-full text-xs text-text-muted hover:text-text-primary gap-1">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        )}
      </motion.div>
    </div>
  );
}

export default function RequestAccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper-0 flex items-center justify-center text-text-muted">Loading...</div>}>
      <RequestAccessContent />
    </Suspense>
  );
}
