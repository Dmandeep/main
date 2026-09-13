"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-paper-0">
      <div className="text-center relative z-10 max-w-md">
        <div className="h-16 w-16 rounded-2xl bg-[#E5484D]/15 border border-[#E5484D]/20 flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="h-8 w-8 text-[#E5484D]" />
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2 font-display">Something went wrong</h1>
        <p className="text-text-secondary mb-8">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button variant="gradient" onClick={reset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Link href="/feed">
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Feed
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
