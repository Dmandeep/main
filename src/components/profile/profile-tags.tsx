"use client";

import { Award, Tag as TagIcon, Users } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Profile tags.
 *
 * Tags carry their provenance in how they look. A tag a student chose for
 * themselves and a tag the system issued for verified work are different
 * kinds of claim, and a profile that renders them identically lets decoration
 * borrow the authority of a record.
 */

export interface ProfileTagView {
  _id: string;
  label: string;
  /** "self" | "earned" | "community" | "faculty" */
  source: string;
  sourceRef?: string;
}

const SOURCE_STYLE: Record<
  string,
  { className: string; icon: React.ReactNode | null; title: string }
> = {
  earned: {
    className: "border-stamp-verified/40 bg-stamp-verified/10 text-stamp-verified",
    icon: <Award className="h-3 w-3" />,
    title: "Issued by the system for verified work. Cannot be self-assigned.",
  },
  faculty: {
    className: "border-ink-300 bg-paper-2 text-ink-900",
    icon: <Award className="h-3 w-3" />,
    title: "Given by a faculty member.",
  },
  community: {
    className: "border-rule bg-paper-1/60 text-text-secondary",
    icon: <Users className="h-3 w-3" />,
    title: "Given by a community this student belongs to.",
  },
  self: {
    className: "border-rule bg-transparent text-text-secondary",
    icon: null,
    title: "Chosen by this student. Not checked by anyone.",
  },
};

export function ProfileTags({
  tags,
  onRemove,
}: {
  tags: ProfileTagView[];
  /** Provided only on your own profile, and only for tags you chose. */
  onRemove?: (tag: ProfileTagView) => void;
}) {
  if (tags.length === 0 && !onRemove) return null;

  // Earned first: what someone did outranks what they called themselves.
  const ordered = [...tags].sort((a, b) => {
    const rank = (t: ProfileTagView) => (t.source === "self" ? 1 : 0);
    return rank(a) - rank(b);
  });

  return (
    <Card variant="glass" className="p-6">
      <h3 className="mb-4 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
        <TagIcon className="h-3 w-3" /> Tags
      </h3>

      {ordered.length === 0 ? (
        <p className="text-sm text-text-muted">No tags yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ordered.map((tag) => {
            const style = SOURCE_STYLE[tag.source] ?? SOURCE_STYLE.self!;
            const removable = onRemove && tag.source === "self";

            return (
              <li key={tag._id}>
                <span
                  title={tag.sourceRef ? `${style.title} (${tag.sourceRef})` : style.title}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${style.className}`}
                >
                  {style.icon}
                  {tag.label}
                  {removable && (
                    <button
                      type="button"
                      onClick={() => onRemove(tag)}
                      aria-label={`Remove tag ${tag.label}`}
                      className="ml-0.5 cursor-pointer text-text-muted transition-colors hover:text-stamp-rejected"
                    >
                      ×
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
