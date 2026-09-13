"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { href: "#process", label: "How it works" },
  { href: "#features", label: "What you get" },
  { href: "#compare", label: "Why not a group chat" },
] as const;

/**
 * Public site header.
 *
 * Rebuilt because the previous one hid every navigation control below the `sm`
 * breakpoint — including Sign In — with no menu to replace them. A returning
 * student on a phone had exactly one control, "Get Started", which sends an
 * existing account into signup. Measured before the fix: five of six header
 * controls reported `visible:false` at 390px.
 *
 * The sheet is a plain element with `hidden`, not a motion component, so it
 * costs nothing on the landing route and behaves with JS still parsing.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus returns to the control that opened it.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    // Scrolling the page behind an open sheet is disorienting on a phone.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-paper-0/95 border-b border-rule">
      <div className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-12">
        <Link href="/" className="flex items-center gap-3 min-h-[44px]">
          <span className="w-8 h-8 rounded-[var(--r-sm)] bg-ink-900 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-paper-0" aria-hidden />
          </span>
          <span className="text-xl font-normal tracking-[-0.02em] text-ink-900 font-display">
            IdeaSpace
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8" aria-label="Sections">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="text-sm font-medium text-text-secondary hover:text-ink-900 transition-colors"
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Sign In is always reachable. On mobile it is the visible control,
              because a returning student is the more likely visitor. */}
          <Link
            href="/auth/login"
            className="inline-flex items-center min-h-[44px] px-3 text-sm font-medium text-text-secondary hover:text-ink-900 transition-colors"
          >
            Sign in
          </Link>

          <Link href="/auth/register" className="hidden sm:block">
            <Button variant="primary" size="sm" className="min-h-[44px]">
              Get started <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>

          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls={panelId}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-[var(--r-sm)] text-ink-900 hover:bg-ink-900/5 transition-colors"
          >
            <Menu className="h-5 w-5" aria-hidden />
            <span className="sr-only">Open menu</span>
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      <div
        id={panelId}
        hidden={!open}
        className="md:hidden fixed inset-0 z-50 bg-paper-0"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-rule">
          <span className="font-display text-xl text-ink-900">Menu</span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-[var(--r-sm)] text-ink-900 hover:bg-ink-900/5 transition-colors"
          >
            <X className="h-5 w-5" aria-hidden />
            <span className="sr-only">Close menu</span>
          </button>
        </div>

        <nav className="px-4 py-2" aria-label="Sections">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              className="flex items-center min-h-[56px] border-b border-rule-soft text-lg text-ink-900"
            >
              {s.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 pt-6 space-y-3">
          <Link href="/auth/register" onClick={() => setOpen(false)} className="block">
            <Button variant="primary" className="w-full min-h-[52px] text-base">
              Get started
            </Button>
          </Link>
          <Link href="/auth/login" onClick={() => setOpen(false)} className="block">
            <Button variant="secondary" className="w-full min-h-[52px] text-base">
              Sign in
            </Button>
          </Link>
          <p className="pt-2 text-sm text-text-muted text-center">
            Use your institutional email address.
          </p>
        </div>
      </div>
    </header>
  );
}
