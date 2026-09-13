"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)", y: 0 }}
      transition={{ 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1] // Cinematic Apple-style cubic-bezier
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
