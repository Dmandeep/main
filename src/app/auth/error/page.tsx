"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft, Send } from "lucide-react";
import { motion } from "framer-motion";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const reason = searchParams.get("reason");

  const isAccessDenied = error === "AccessDenied" || reason === "institutional_email_required";

  return (
    <div className="min-h-screen bg-paper-0 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card variant="glass" className="p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-danger/10 border border-danger/20 text-danger mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary font-display">
              {isAccessDenied ? "Access Restricted" : "Authentication Error"}
            </h1>
            <p className="text-sm text-text-secondary mt-2">
              {isAccessDenied
                ? "This account is not yet registered in the campus directory, or needs administrator approval."
                : "There was a problem signing you in. Please check your credentials and try again."}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link href="/auth/request-access">
              <Button variant="gradient" className="w-full gap-2 font-bold">
                <Send className="h-4 w-4" /> Request Access from Admin
              </Button>
            </Link>

            <Link href="/auth/login">
              <Button variant="secondary" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper-0 flex items-center justify-center text-text-muted">Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
