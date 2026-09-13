"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, Users, Lightbulb, ShieldCheck, Hammer, Target, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { canSessionRole } from "@/lib/authz/permissions";

/**
 * The staff landing page.
 *
 * Cards are gated by capability, not by "is this person staff". An HOD who is
 * shown a Review Queue button gets a 401 from the handler behind it, which
 * reads as a broken product rather than as the deliberate separation it is.
 */
export default function AdminPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const mayVerify = canSessionRole(role, "VERIFY_EVIDENCE");
  const mayApprove = canSessionRole(role, "APPROVE_MEMBERSHIP");

  const [stats, setStats] = useState({ totalIdeas: 0, activeBuilds: 0, shipped: 0, totalUsers: 0, totalProofs: 0, totalWorkshops: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then(r => r.json())
      .then(d => { if (d.data) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const kpis = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-stamp-verified" },
    { label: "Total Ideas", value: stats.totalIdeas, icon: Lightbulb, color: "text-[#3D8BFF]" },
    { label: "Active Builds", value: stats.activeBuilds, icon: LayoutDashboard, color: "text-[#F2B24B]" },
    { label: "Shipped", value: stats.shipped, icon: ShieldCheck, color: "text-[#2EA86A]" },
    { label: "Verified Proofs", value: stats.totalProofs, icon: Target, color: "text-[#22D3EE]" },
    { label: "Workshops", value: stats.totalWorkshops, icon: Hammer, color: "text-[#FF6B4A]" },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-text-primary font-display">Admin Dashboard</h1>
          <p className="text-text-secondary mt-1">Platform overview and management.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {kpis.map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card variant="spotlight" className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    <Badge variant="secondary" className="text-[9px]">{kpi.label}</Badge>
                  </div>
                  <div className={`text-3xl font-bold font-display ${kpi.color}`}>{kpi.value}</div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {mayVerify && (
          <Card variant="glass" className="p-6">
            <h2 className="text-lg font-bold text-text-primary mb-3 font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-stamp-verified" /> Review Queue
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              You have pending items that require verification. This includes proof of work evidence, idea milestones, and bounty submissions.
            </p>
            <Link href="/admin/review">
              <Button variant="gradient" className="w-full">
                Go to Review Queue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </Card>
          )}

          {mayApprove && (
          <Card variant="glass" className="p-6">
            <h2 className="text-lg font-bold text-text-primary mb-3 font-display flex items-center gap-2">
              <Users className="h-5 w-5 text-stamp-verified" /> Access Requests & Form Roster
            </h2>
            <p className="text-sm text-text-secondary mb-6">
              Review student access requests and dump Google Form responses for instant automated sign-in.
            </p>
            <Link href="/admin/access-requests">
              <Button variant="gradient" className="w-full">
                Manage Access & Dump Forms <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </Card>
          )}
        </div>

        {!mayVerify && mayApprove && (
          <p className="mt-4 text-sm text-text-secondary">
            Evidence verification sits with faculty, not with the department
            head. Approving someone and validating their work are deliberately
            two different people.
          </p>
        )}

        <div className="mt-8 p-6 rounded-[var(--radius-lg)] border border-rule bg-paper-1/30">
          <h2 className="text-lg font-bold text-text-primary mb-3 font-display">System Status</h2>
          <div className="text-sm text-text-secondary space-y-2">
            <p>• <span className="text-success font-bold">●</span> Review Queue: <span className="text-text-primary">Operational</span></p>
            <p>• <span className="text-success font-bold">●</span> Database: <span className="text-text-primary">PostgreSQL 17</span></p>
            <p>• <span className="text-warning font-bold">○</span> User Management: <span className="text-text-primary">Under Development</span></p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
