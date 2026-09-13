"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The proof strip.
 *
 * Three lines of real ledger shape, sitting at the foot of the fold where a
 * logo wall normally goes. Evidence is this product's social proof, so evidence
 * is the thing shown.
 *
 * This holds the page's only choreographed moment: the VERIFIED marks press in
 * one after another, overshooting slightly, the way a stamp meets paper. It
 * earns its place because it is the product's actual thesis — a claim becoming
 * a record — rather than decoration behind the headline.
 *
 * An earlier version drew a green arc through the title. It was a highlighter
 * swoosh with no meaning, it hurt legibility, and it is gone.
 */

const ROWS = [
  { event: "PR #184 merged", state: "VERIFIED" },
  { event: "Demo deployed", state: "VERIFIED" },
  { event: "Milestone 03", state: "PENDING" },
] as const;

export function LedgerPreview() {
  const [revealed, setRevealed] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      const t = window.setTimeout(() => setRevealed(ROWS.length), 0);
      return () => window.clearTimeout(t);
    }

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        ROWS.forEach((_, i) => {
          window.setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), i * 220);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    io.observe(el);

    // Safety net: on a short viewport the strip can already be past the
    // threshold before the observer attaches. Decoration must never be able to
    // hide content, so reveal regardless.
    const fallback = window.setTimeout(() => {
      io.disconnect();
      setRevealed(ROWS.length);
    }, 1800);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [reduce]);

  return (
    <div ref={ref} className="relative">
      <ul className="flex flex-col sm:flex-row sm:items-center sm:justify-center divide-y sm:divide-y-0 sm:divide-x divide-rule border-y border-rule">
        {ROWS.map((r, i) => {
          const shown = i < revealed;
          const verified = r.state === "VERIFIED";
          const presses = verified && !reduce;

          return (
            <li
              key={r.event}
              className="flex items-center justify-between sm:justify-center gap-3 px-5 sm:px-7 py-4 sm:flex-1"
            >
              <span className={`text-sm ${verified ? "text-ink-900" : "text-ink-300"}`}>
                {r.event}
              </span>

              {/* The stamp press: scale overshoot plus a fraction of rotation,
                  so it lands rather than fades. Pending never presses — nothing
                  has happened to it yet. */}
              <motion.span
                initial={presses ? { opacity: 0, scale: 1.7, rotate: -14 } : { opacity: 0 }}
                animate={
                  shown
                    ? presses
                      ? { opacity: 1, scale: 1, rotate: -2 }
                      : { opacity: 1 }
                    : { opacity: 0 }
                }
                transition={
                  presses
                    ? { type: "spring", stiffness: 420, damping: 18 }
                    : { duration: 0.4 }
                }
                className={[
                  "shrink-0 font-mono text-[10px] uppercase tracking-[0.12em]",
                  verified
                    ? "text-stamp-verified border border-stamp-verified/40 rounded-[var(--r-sm)] px-1.5 py-0.5"
                    : "text-ink-300",
                ].join(" ")}
              >
                {r.state}
              </motion.span>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
        Sample ledger
      </p>
    </div>
  );
}
