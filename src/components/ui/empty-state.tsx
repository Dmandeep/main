"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { MarkEmpty } from "@/components/marks";

/**
 * The empty state.
 *
 * A blank screen with a sentence of grey text is where a student decides the
 * product is dead. A drawn object and one clear action is where they decide it
 * is waiting for them — so every empty state gets a mark, and the mark is from
 * the same archival hand as the landing page rather than a generic icon in a
 * rounded square.
 *
 * The action is the point of the component. An empty state with nothing to do
 * next is just a smaller error page.
 */

export interface EmptyStateProps {
  /** A mark from @/components/marks. Defaults to the empty pigeonhole rack. */
  mark?: React.ComponentType<{ className?: string; title?: string }>;
  /** Escape hatch for callers passing their own node. */
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** A quieter second action, for "or do this instead". */
  secondary?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({
  mark: Mark = MarkEmpty,
  icon,
  title,
  description,
  action,
  secondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20",
        className
      )}
    >
      {icon ?? <Mark className="mb-6 h-16 w-16 text-ink-300" />}

      <h3 className="font-display text-xl text-ink-900">{title}</h3>
      {/* Capped at the reading measure: a centred paragraph wider than this
          is genuinely harder to read, and empty states are read cold. */}
      <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-700">{description}</p>

      {(action || secondary) && (
        <div className="mt-7 flex flex-col items-center gap-4 sm:flex-row">
          {action &&
            (action.href ? (
              <Link href={action.href}>
                <Button variant="primary">{action.label}</Button>
              </Link>
            ) : (
              <Button variant="primary" onClick={action.onClick}>
                {action.label}
              </Button>
            ))}

          {secondary && (
            <Link
              href={secondary.href}
              className="text-sm text-ink-700 underline decoration-rule underline-offset-4 transition-colors hover:text-ink-900 hover:decoration-ink-900"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
