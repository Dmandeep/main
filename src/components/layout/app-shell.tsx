"use client";

import { Sidebar } from "./sidebar";
import { motion } from "framer-motion";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper-0">
      {/* Aurora background */}
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="md:pl-[260px] flex flex-col flex-1 min-h-screen relative z-10">
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 p-4 pt-18 md:pt-8 md:p-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
