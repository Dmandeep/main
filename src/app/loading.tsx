import { Zap } from "lucide-react";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper-0">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-[var(--r-md)] bg-ink-900 flex items-center justify-center">
          <Zap className="h-6 w-6 text-paper-0" />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-ink-900/60 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="h-2 w-2 rounded-full bg-ink-900/60 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="h-2 w-2 rounded-full bg-ink-900/60 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
