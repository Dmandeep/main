"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ImportReposPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/github/repos");
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch repos");
        }
        
        setRepos(data.data || []);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(String(err));
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchRepos();
  }, []);

  const toggleSelection = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === repos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(repos.map((r) => r.id)));
    }
  };

  const handleImport = async () => {
    const selectedRepos = repos.filter((r) => selectedIds.has(r.id));
    if (selectedRepos.length === 0) return;

    try {
      setImporting(true);
      const res = await fetch("/api/github/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: selectedRepos }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Import failed");
      }
      
      router.push("/dashboard"); // or wherever the user's drafts are
    } catch (err) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert(String(err));
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen aurora-bg pt-24 pb-12 px-5 sm:px-6 relative overflow-hidden">
      <div className="fixed inset-0 paper-tooth pointer-events-none" aria-hidden />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="inline-flex items-center text-sm text-ink-500 hover:text-ink-900 transition-colors mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-display font-normal text-ink-900 flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-ink-700" />
              Import from GitHub
            </h1>
            <p className="mt-2 text-ink-700">Select repositories to import as Idea drafts.</p>
          </div>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
            className="w-full sm:w-auto gradient-btn h-11 px-6 rounded-full shadow-md transition-all disabled:opacity-50"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="glass-panel border-red-500/20 bg-red-500/5 p-4 rounded-xl mb-8">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="glass-panel p-12 rounded-[var(--r-lg)] flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-ink-400 animate-spin mb-4" />
            <p className="text-ink-500 text-sm">Fetching repositories...</p>
          </div>
        ) : !error && repos.length === 0 ? (
          <div className="glass-panel p-12 rounded-[var(--r-lg)] text-center">
            <p className="text-ink-700">No repositories found on your GitHub account.</p>
          </div>
        ) : repos.length > 0 ? (
          <div className="glass-panel rounded-[var(--r-lg)] overflow-hidden">
            <div className="border-b border-rule bg-paper-1 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={selectAll}
                  className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    selectedIds.size === repos.length 
                      ? "bg-ink-900 border-ink-900 text-white" 
                      : "border-ink-300 hover:border-ink-500 text-transparent"
                  }`}
                >
                  <Check className="w-3 h-3" />
                </button>
                <span className="text-sm font-mono text-ink-500 uppercase tracking-wider">
                  Select All
                </span>
              </div>
              <span className="text-sm text-ink-500">
                {repos.length} repositories found
              </span>
            </div>
            <div className="divide-y divide-rule max-h-[600px] overflow-y-auto">
              {repos.map((repo) => {
                const isSelected = selectedIds.has(repo.id);
                return (
                  <div 
                    key={repo.id} 
                    className={`p-6 flex items-start gap-4 transition-colors hover:bg-paper-1/50 cursor-pointer ${
                      isSelected ? "bg-paper-1" : ""
                    }`}
                    onClick={() => toggleSelection(repo.id)}
                  >
                    <div 
                      className={`mt-1 w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center transition-colors ${
                        isSelected 
                          ? "bg-ink-900 border-ink-900 text-white" 
                          : "border-ink-300 text-transparent"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="font-medium text-ink-900 truncate text-lg">
                          {repo.name}
                        </h3>
                        {repo.language && (
                          <span className="text-xs font-mono px-2 py-1 bg-paper-2 rounded text-ink-600 border border-rule">
                            {repo.language}
                          </span>
                        )}
                      </div>
                      {repo.description && (
                        <p className="mt-1 text-sm text-ink-500 line-clamp-2">
                          {repo.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-4 text-xs text-ink-400 font-mono">
                        <span>★ {repo.stargazers_count}</span>
                        <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
