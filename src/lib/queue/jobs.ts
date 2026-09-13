/**
 * The job catalogue.
 *
 * Names and payload shapes live apart from both the producer and the worker so
 * that neither can drift from the other: a typo in a queue name is a
 * compile error rather than a job that enqueues successfully and is never
 * consumed.
 *
 * What belongs on a queue here is work that must happen but must not make a
 * student wait, and that is safe to retry. Everything listed is idempotent —
 * standing is recomputed from an append-only ledger, evidence counters are
 * rebuilt from evidence rows, notifications are keyed. Retrying any of them
 * twice produces the same state as running it once, which is the only reason
 * a retrying queue is safe to point at a database.
 */

// Hyphens, not colons: BullMQ reserves ":" as its own key separator and
// rejects a queue name containing one.
export const QUEUE_NAMES = {
  maintenance: "ideaspace-maintenance",
  notifications: "ideaspace-notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Rebuild standing from the ledger, and evidence counters from evidence. */
export interface RecomputeStandingJob {
  name: "recompute-standing";
  data: { tenantId: string };
}

export interface ReconcileEvidenceJob {
  name: "reconcile-evidence";
  data: { tenantId?: string };
}

/** Promote from a waitlist when seats free up. */
export interface SweepWaitlistsJob {
  name: "sweep-waitlists";
  data: { tenantId: string };
}

export type MaintenanceJob = RecomputeStandingJob | ReconcileEvidenceJob | SweepWaitlistsJob;

export interface SendNotificationJob {
  name: "send-notification";
  data: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    href?: string;
  };
}

export type NotificationJob = SendNotificationJob;

/**
 * Retry policy.
 *
 * Exponential from two seconds, five attempts. Kept here rather than at each
 * call site so a job cannot be added with no retry at all — a maintenance job
 * that fails once and is dropped leaves the cached numbers wrong until someone
 * notices, which is exactly the failure the reconciler exists to catch.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 200 },
  // Failures are kept longer than successes: a failed job is evidence about
  // why something is wrong and is worth more than a completed one.
  removeOnFail: { count: 1000 },
};
