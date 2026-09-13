/**
 * The illustration language.
 *
 * One register: archival line-work. Single stroke weight (1.25), square-ish
 * joins, no fills except paper, everything drawn in `currentColor` so a mark
 * inherits ink or stamp colour from its container and themes for free.
 *
 * The subjects are deliberately campus objects — a notice board, a lab bench,
 * a filing card, a rubber stamp — rather than the abstract blobs and floating
 * gradients that make every student platform look like the same product. A
 * mark is structural, never decorative: each one labels a real step in the
 * loop, and none of them animate on their own.
 *
 * Anything here must read at 32px on a 4GB Android phone, so no gradients,
 * no filters, no masks.
 */

interface MarkProps {
  className?: string;
  /** Decorative by default; pass a label when the mark carries meaning alone. */
  title?: string;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Frame({
  children,
  className,
  title,
}: MarkProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/** A pinned notice — an idea posted where the department can see it. */
export function MarkNotice(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="9" y="12" width="30" height="28" rx="1.5" />
        <path d="M14 20h16M14 26h20M14 32h11" />
        <circle cx="24" cy="9" r="2.5" />
        <path d="M24 11.5V12" />
      </g>
    </Frame>
  );
}

/** A bench with work on it — a team actually building. */
export function MarkBench(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <path d="M7 28h34" />
        <path d="M11 28v11M37 28v11" />
        <rect x="14" y="17" width="12" height="11" rx="1" />
        <path d="M29 23h7M29 23l2.5-2.5M29 23l2.5 2.5" />
        <path d="M17 21h6M17 24h4" />
      </g>
    </Frame>
  );
}

/** A rubber stamp pressing down — verification, the product's core act. */
export function MarkStamp(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="14" y="9" width="20" height="12" rx="1.5" />
        <path d="M21 21v5h6v-5" />
        <rect x="11" y="26" width="26" height="6" rx="1.5" />
        <path d="M9 38h30" />
        <path d="M20 15l3 3 5-6" />
      </g>
    </Frame>
  );
}

/** A filing card with a tab — the record that outlives the student. */
export function MarkCard(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <path d="M9 15h13l3 4h14v21H9z" />
        <path d="M14 26h18M14 31h12" />
      </g>
    </Frame>
  );
}

/** Two figures, one handing over — juniors inheriting a project. */
export function MarkHandoff(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <circle cx="14" cy="15" r="4" />
        <path d="M8 33v-4a6 6 0 0 1 12 0v4" />
        <circle cx="34" cy="15" r="4" />
        <path d="M28 33v-4a6 6 0 0 1 12 0v4" />
        <path d="M20 24h8M28 24l-2.5-2.5M28 24l-2.5 2.5" />
      </g>
    </Frame>
  );
}

/** A ledger column — standing, derived and auditable. */
export function MarkLedger(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="10" y="10" width="28" height="30" rx="1.5" />
        <path d="M10 18h28M19 18v22" />
        <path d="M23 24h11M23 30h8M23 36h11" />
      </g>
    </Frame>
  );
}

/**
 * The Provenance Stamp: a letterpress mark, not a glowing badge.
 *
 * Slight rotation and an open ring so it reads as ink pressed onto paper
 * rather than a UI chip. Used at the point where a claim becomes a record.
 */
export function StampMark({
  label = "VERIFIED",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={label}>
      <title>{label}</title>
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        transform="rotate(-8 60 60)"
      >
        {/* Open ring: a real stamp never inks evenly all the way round. */}
        <path d="M60 12a48 48 0 1 1-34 82" />
        <path d="M18 84a48 48 0 0 1 8-58" />
        <circle cx="60" cy="60" r="36" strokeWidth={1.25} />
        <path d="M45 60l10 10 20-22" strokeWidth={4} />
      </g>
      <text
        x="60"
        y="96"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        style={{
          font: "600 11px var(--font-mono), monospace",
          letterSpacing: "0.18em",
        }}
        transform="rotate(-8 60 60)"
      >
        {label}
      </text>
    </svg>
  );
}

/**
 * Ruled paper. Drawn as a tiling SVG pattern rather than a raster so it stays
 * sharp, weighs nothing, and inherits the rule colour in both themes.
 */
export function RuledPaper({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden focusable="false">
      <defs>
        <pattern id="ruled" width="100%" height="28" patternUnits="userSpaceOnUse">
          <line
            x1="0"
            y1="27.5"
            x2="100%"
            y2="27.5"
            stroke="var(--rule-soft)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ruled)" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * App marks.
 *
 * The six above were drawn for the landing page's loop. These extend the same
 * register — one stroke weight, campus objects, no fills — to the surfaces
 * inside the product, so an empty bounty list and a pinned notice on the
 * homepage are recognisably the same hand.
 *
 * They exist mostly for empty and first-run states. A blank screen with a
 * sentence of grey text is where a student decides the product is dead; a
 * drawn object and a clear next action is where they decide it is waiting
 * for them.
 * ------------------------------------------------------------------------- */

/** A pegboard with one tool missing — an open bounty, work waiting to be taken. */
export function MarkBounty(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="9" y="10" width="30" height="28" rx="1.5" />
        <path d="M15 17v7a3 3 0 0 0 6 0v-7" />
        <path d="M18 24v7" />
        <path d="M27 17h6l-3 5 3 5h-6" />
        <path d="M13 34h22" strokeDasharray="2 3" />
      </g>
    </Frame>
  );
}

/** A stacking chair — one seat at an event, kept or waiting. */
export function MarkSeat(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <path d="M16 10h14v16H16z" />
        <path d="M13 26h22" />
        <path d="M16 26v12M32 26v12" />
        <path d="M20 15h6" />
      </g>
    </Frame>
  );
}

/** Chairs in a circle — a community room, seen from above. */
export function MarkRoom(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <circle cx="24" cy="24" r="8" />
        <circle cx="24" cy="10" r="2.5" />
        <circle cx="24" cy="38" r="2.5" />
        <circle cx="10" cy="24" r="2.5" />
        <circle cx="38" cy="24" r="2.5" />
        <circle cx="14" cy="14" r="2.5" />
        <circle cx="34" cy="34" r="2.5" />
      </g>
    </Frame>
  );
}

/** A wall calendar with one date ringed — something scheduled. */
export function MarkCalendar(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="9" y="12" width="30" height="27" rx="1.5" />
        <path d="M9 20h30" />
        <path d="M17 9v6M31 9v6" />
        <circle cx="19" cy="28" r="3.5" />
        <path d="M27 27h7M27 33h5" />
      </g>
    </Frame>
  );
}

/** An empty pigeonhole rack — nothing filed here yet. */
export function MarkEmpty(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="8" y="13" width="32" height="22" rx="1.5" />
        <path d="M8 24h32M24 13v22" />
        <path d="M13 19h6" strokeDasharray="2 3" />
        <path d="M29 30h6" strokeDasharray="2 3" />
      </g>
    </Frame>
  );
}

/** A magnifier over a card — a search that found nothing. */
export function MarkSearch(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="9" y="11" width="22" height="26" rx="1.5" />
        <path d="M14 18h10M14 23h7" />
        <circle cx="30" cy="30" r="7" />
        <path d="M35 35l5 5" />
      </g>
    </Frame>
  );
}

/** An envelope in a rack — notifications, nothing unread. */
export function MarkPost(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <rect x="9" y="14" width="30" height="21" rx="1.5" />
        <path d="M9 16l15 11 15-11" />
      </g>
    </Frame>
  );
}

/** A plumb line hanging true — standing, measured rather than claimed. */
export function MarkPlumb(props: MarkProps) {
  return (
    <Frame {...props}>
      <g {...stroke}>
        <path d="M24 8v20" />
        <path d="M18 28h12l-6 11z" />
        <path d="M12 8h24" />
      </g>
    </Frame>
  );
}
