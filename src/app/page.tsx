"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, GitBranch, Code2, Users, Trophy } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { LedgerPreview } from "@/components/landing/ledger-preview";

export default function LandingPage() {
  const [stats, setStats] = useState({ totalIdeas: 0, activeBuilds: 0, shipped: 0, totalProofs: 0 });

  useEffect(() => {
    fetch("/api/stats").then(r => r.json()).then(d => {
      if (d.data) setStats(d.data);
    }).catch(() => {});
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-sky-50 selection:bg-indigo-500 selection:text-white">
      {/* OUTSTANDING Animated Watercolor/Mesh Gradient Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-teal-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[10%] -right-[10%] w-[70vw] h-[70vw] bg-sky-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-70 animate-pulse" style={{ animationDuration: '10s', animationDelay: "1s" }} />
        <div className="absolute -bottom-[20%] left-[20%] w-[80vw] h-[80vw] bg-violet-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-pulse" style={{ animationDuration: '12s', animationDelay: "2s" }} />
      </div>

      <SiteHeader />

      <main className="relative z-10">
        {/* HERO SECTION - 2 Column Split Layout */}
        <section className="relative px-5 sm:px-6 lg:px-12 pt-32 pb-24 md:pt-48 md:pb-32 flex flex-col lg:flex-row items-center justify-between min-h-[85vh] max-w-7xl mx-auto gap-12">
          
          {/* Left Column: Text & Buttons */}
          <motion.div 
            initial="hidden" 
            animate="show" 
            variants={containerVariants}
            className="w-full lg:w-1/2 flex flex-col items-start text-left"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-rose-100 border border-rose-200 shadow-sm text-sm font-bold text-rose-700 mb-8 backdrop-blur-md">
              <Sparkles className="w-4 h-4" />
              <span>Now integrated with GitHub Webhooks & Gamification</span>
            </motion.div>

            <motion.h1 variants={itemVariants} className="font-display font-bold text-5xl sm:text-6xl xl:text-[5.5rem] tracking-tight leading-[1.1] text-indigo-950 mb-8">
              Ship real code. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500">
                Earn reputation.
              </span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-lg sm:text-xl text-indigo-800/80 leading-relaxed max-w-xl mb-12 font-medium">
              The premier platform for university developers. Connect your GitHub, collaborate on brilliant ideas, and automatically earn verified leaderboard points for every commit.
            </motion.p>

            {/* Changed Button Placements - Left Aligned, Vertical on Mobile, Horizontal on Desktop */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-start justify-start gap-4 w-full">
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl shadow-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 transform hover:-translate-y-1 border-b-4 border-indigo-800">
                  Start Building Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/feed" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base border-2 border-emerald-300 hover:border-emerald-400 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg shadow-emerald-200/50">
                  <GitBranch className="mr-2 w-5 h-5" />
                  View the Ledger
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Column: Dashboard Preview */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="w-full lg:w-1/2 mt-16 lg:mt-0"
          >
            <div className="rounded-[2rem] border-4 border-white/60 bg-white/40 backdrop-blur-3xl p-3 shadow-2xl shadow-indigo-900/10 rotate-1 hover:rotate-0 transition-transform duration-700">
              <div className="rounded-2xl overflow-hidden bg-sky-100 border border-sky-200/50 shadow-inner">
                <LedgerPreview />
              </div>
            </div>
          </motion.div>
        </section>

        {/* METRICS */}
        <section className="py-16 border-y border-sky-200 bg-sky-50/60 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Ideas Proposed", value: stats.totalIdeas, icon: Code2 },
              { label: "Active Builds", value: stats.activeBuilds, icon: Users },
              { label: "Products Shipped", value: stats.shipped, icon: Trophy },
              { label: "Verified Commits", value: stats.totalProofs, icon: GitBranch },
            ].map((stat, i) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                key={stat.label} 
                className="text-center flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-4xl font-bold text-slate-900 tracking-tight tabular-nums">
                  {stat.value || "0"}
                </div>
                <div className="mt-2 text-sm font-medium text-slate-500 uppercase tracking-wider">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-32 px-6 relative">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-20">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6">Engineered for builders.</h2>
              <p className="text-lg text-slate-500 text-pretty">IdeaSpace isn't just a forum. It's a verified cryptographic ledger of your university contributions, seamlessly synced with GitHub.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { title: "Connect GitHub", desc: "Link your repositories securely with OAuth. We listen to your webhooks automatically.", color: "from-sky-100 to-sky-50" },
                { title: "Write Code", desc: "Push code to your linked repos. Our AI gamification engine analyzes your diffs and commit messages.", color: "from-indigo-100 to-indigo-50" },
                { title: "Climb the Ranks", desc: "Earn verified reputation points for every meaningful commit and display your proof of work.", color: "from-amber-100 to-amber-50" }
              ].map((feature, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  key={feature.title} 
                  className="rounded-3xl p-8 border border-sky-200 bg-sky-50 shadow-sm hover:shadow-xl transition-all duration-300 group"
                >
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <div className="text-2xl font-bold text-slate-700">{i + 1}</div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                  <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
