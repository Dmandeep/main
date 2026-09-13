"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { platformLabel, profileUrl, showsAsVerified } from "@/lib/profile/links";

/**
 * The connected-accounts panel.
 *
 * Reads as a single identity across platforms, but with one rule the genre
 * usually breaks: a claimed handle and a proven one never look the same. Only
 * GitHub can be proven today, so everything else carries its handle and the
 * student's own typed-in stat, presented as what it is.
 *
 * Stats are shown in the student's own words rather than fetched and
 * normalised. Scraping LeetCode to render an authoritative-looking number
 * would be presenting an unverified figure as a fact — the exact thing the
 * verified badge exists to prevent.
 */

export interface ProfileLinkView {
  _id: string;
  platform: string;
  handle: string;
  isVerified: boolean;
  statLabel?: string;
  statValue?: string;
}

export function ConnectedAccounts({ links }: { links: ProfileLinkView[] }) {
  if (links.length === 0) return null;

  return (
    <Card variant="glass" className="p-6">
      <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
        Accounts elsewhere
      </h3>

      {/* Pills, not a card grid. A student with six accounts had six boxes
          stacked down the page, which made a side note look like the main
          event. Each pill still carries whether it is proven, because that
          distinction is the one thing here that must not be lost to
          compactness. */}
      <ul className="flex flex-wrap gap-2">
        {links.map((link) => {
          const url = profileUrl(link.platform, link.handle);
          const verified = showsAsVerified(link.platform, link.isVerified);

          const inner = (
            <>
              {verified ? (
                <ShieldCheck
                  className="h-3.5 w-3.5 shrink-0 text-stamp-verified"
                  aria-label="Ownership proven by signing in with this account"
                />
              ) : null}
              <span className="font-medium text-ink-900">{platformLabel(link.platform)}</span>
              <span className="text-ink-500">{link.handle}</span>
              {link.statValue && (
                <span className="border-l border-rule pl-2 text-ink-700">
                  {link.statLabel ? `${link.statLabel} ` : ""}
                  {link.statValue}
                </span>
              )}
              {url && <ExternalLink className="h-3 w-3 shrink-0 text-ink-300" aria-hidden />}
            </>
          );

          const className =
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors " +
            (verified
              ? "border-stamp-verified/35 bg-stamp-verified/[0.07]"
              : "border-rule bg-paper-1/60");

          return (
            <li key={link._id}>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  // noreferrer as well as noopener: these are links a student
                  // typed in, and the destination has no business learning
                  // which campus profile sent the traffic.
                  rel="noopener noreferrer nofollow"
                  title={
                    verified
                      ? "Ownership proven by signing in with this account"
                      : "Typed in by this student. Nobody has checked it."
                  }
                  className={className + " hover:border-ink-300"}
                >
                  {inner}
                </a>
              ) : (
                <span
                  title="Typed in by this student. Nobody has checked it."
                  className={className}
                >
                  {inner}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-300">
        Only GitHub can be proven. Everything else is a claim.
      </p>
    </Card>
  );
}
