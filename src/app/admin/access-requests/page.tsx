"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  Upload,
  Search,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Mail,
  GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/ToastSystem";

interface AccessRequestItem {
  id: string;
  name: string;
  email: string;
  department: string | null;
  year: number | null;
  rollNumber: string | null;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedBy?: { id: string; name: string; email: string } | null;
}

export default function AdminAccessRequestsPage() {
  const [activeTab, setActiveTab] = useState<"requests" | "dump">("requests");
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Dump form state
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // TanStack Query rather than fetch-in-effect: calling setState synchronously
  // inside an effect triggers cascading renders, which the React Compiler
  // flags as an error. It also gives refetch for free after approve/reject.
  const {
    data: requests = [],
    isPending: loading,
    refetch: fetchRequests,
  } = useQuery<AccessRequestItem[]>({
    queryKey: ["admin-access-requests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/access-requests");
      if (!res.ok) throw new Error("Failed to load access requests");
      const body = await res.json();
      return body.data ?? [];
    },
  });

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Approval failed", data.error || "Could not approve request");
        return;
      }
      toast.success("Approved", `Access approved for ${name}. They can now sign in with Google automatically.`);
      fetchRequests();
    } catch {
      toast.error("Network error", "Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    const reason = prompt(`Reason for rejecting ${name}'s request (optional):`) || undefined;
    setProcessingId(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Rejection failed", data.error || "Could not reject request");
        return;
      }
      toast.success("Rejected", `Access request for ${name} rejected.`);
      fetchRequests();
    } catch {
      toast.error("Network error", "Failed to process request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDumpFormsImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      toast.error("Empty data", "Please paste or provide Google Form responses CSV data.");
      return;
    }

    setImporting(true);
    setImportSummary(null);
    try {
      const res = await fetch("/api/admin/roster/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvText,
          filename: "google-form-dump.csv",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Import failed", data.error || "Failed to process dumped form data");
        return;
      }

      toast.success("Form data processed!", data.message);
      setImportSummary(data.message);
      setCsvText("");
      fetchRequests();
    } catch {
      toast.error("Network error", "Failed to submit form dump.");
    } finally {
      setImporting(false);
    }
  };

  const sampleCsv = `Timestamp,Full Name,Institutional Email,Department,Year of Study,GitHub Handle
2026/09/11 10:00:00 AM GMT+5:30,Aditya Sharma,aditya.sharma@lendi.org,Computer Science & Engineering,3,adityasharma
2026/09/11 10:05:00 AM GMT+5:30,Pooja Reddy,pooja.reddy@lendi.edu.in,Computer Science & Engineering,2,poojareddy
2026/09/11 10:10:00 AM GMT+5:30,Manoj Varma,manoj.external@gmail.com,Computer Science & Engineering,1,manojv`;

  const filteredRequests = requests.filter((r) => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.rollNumber && r.rollNumber.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-text-muted hover:text-text-primary gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary font-display flex items-center gap-3">
              Access Requests & Form Roster
              {pendingCount > 0 && (
                <Badge variant="warning" className="text-xs px-2.5 py-0.5">
                  {pendingCount} Pending
                </Badge>
              )}
            </h1>
            <p className="text-text-secondary mt-1 text-sm">
              Manage student access requests and dump Google Form responses for instant automated login.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "requests" ? "primary" : "secondary"}
              onClick={() => setActiveTab("requests")}
              className="gap-2 text-xs font-semibold"
            >
              <Users className="h-4 w-4" /> Access Requests ({requests.length})
            </Button>
            <Button
              variant={activeTab === "dump" ? "primary" : "secondary"}
              onClick={() => setActiveTab("dump")}
              className="gap-2 text-xs font-semibold"
            >
              <FileSpreadsheet className="h-4 w-4" /> Dump Google Forms
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void fetchRequests()} title="Refresh">
              <RefreshCw className="h-4 w-4 text-text-muted" />
            </Button>
          </div>
        </div>

        {activeTab === "requests" ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      filter === status
                        ? "bg-text-primary text-paper-0 shadow-sm"
                        : "bg-paper-1 text-text-secondary hover:text-text-primary border border-rule"
                    }`}
                  >
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  placeholder="Search by name, email, roll no..."
                  className="pl-9 h-9 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card variant="glass" className="p-12 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-paper-1 border border-rule text-text-muted mb-3 mx-auto">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-text-primary font-display">No requests found</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  {filter === "PENDING"
                    ? "All access requests have been reviewed. When students without an imported form try to sign in, their requests will appear here."
                    : "No access requests match your active search or filter."}
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map((req) => (
                  <Card
                    key={req.id}
                    variant="spotlight"
                    className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-text-primary text-sm">{req.name}</span>
                        <span className="text-xs text-text-muted">({req.email})</span>
                        {req.status === "PENDING" && (
                          <Badge variant="warning" className="text-[10px] gap-1">
                            <Clock className="h-3 w-3" /> Pending Review
                          </Badge>
                        )}
                        {req.status === "APPROVED" && (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Approved
                          </Badge>
                        )}
                        {req.status === "REJECTED" && (
                          <Badge variant="danger" className="text-[10px] gap-1">
                            <XCircle className="h-3 w-3" /> Rejected
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap">
                        <span>Dept: <strong className="text-text-primary">{req.department || "CSE"}</strong></span>
                        {req.year && <span>Year: <strong className="text-text-primary">{req.year}</strong></span>}
                        {req.rollNumber && <span>Roll No: <strong className="text-text-primary">{req.rollNumber}</strong></span>}
                        <span className="text-text-muted">Requested: {new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-text-muted italic bg-paper-1/40 px-2 py-1 rounded border border-rule/50 mt-1">
                          &ldquo;{req.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {req.status === "PENDING" ? (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            className="h-8 gap-1.5 text-xs font-bold bg-success hover:bg-success/90 text-white"
                            disabled={processingId === req.id}
                            onClick={() => handleApprove(req.id, req.name)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Enable Login
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            disabled={processingId === req.id}
                            onClick={() => handleReject(req.id, req.name)}
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-text-muted">
                          {req.status === "APPROVED" ? "Enabled for Google OAuth" : "Request Declined"}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card variant="glass" className="p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-text-primary font-display flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-stamp-verified" />
                  Dump Google Forms Responses (CSV Export)
                </h2>
                <p className="text-xs text-text-secondary mt-1 max-w-2xl leading-relaxed">
                  When you download responses from Google Forms (or your college survey sheet), paste the CSV content here. The system will pre-register all student seats. When these students click &ldquo;Sign in with Google&rdquo;, <strong>they will log in automatically</strong> without having to request access!
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="text-xs shrink-0"
                onClick={() => setCsvText(sampleCsv)}
              >
                Load Sample CSV
              </Button>
            </div>

            {importSummary && (
              <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{importSummary}</span>
              </div>
            )}

            <form onSubmit={handleDumpFormsImport} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  Paste Google Forms CSV Data
                </label>
                <textarea
                  className="w-full h-56 font-mono text-xs rounded-[var(--radius-md)] border border-rule bg-paper-1 p-3 text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-ink-900/40 resize-y"
                  placeholder="Timestamp,Name,Email,Department,Year..."
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-xs text-text-muted">
                  Column headers are automatically detected (e.g. Email, Full Name, Department, Year, GitHub).
                </p>

                <Button
                  type="submit"
                  variant="gradient"
                  className="h-10 px-6 font-bold gap-2"
                  disabled={importing}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? "Processing Roster..." : "Dump & Register Form Data"}
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
