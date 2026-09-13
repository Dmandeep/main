import type { Queue } from "bullmq";
import { logger } from "@/lib/logger";
import { getQueueConnection, isQueueEnabled } from "./connection";
import { DEFAULT_JOB_OPTIONS, type MaintenanceJob, type NotificationJob, QUEUE_NAMES } from "./jobs";

/**
 * Producing jobs.
 *
 * Every enqueue answers the same question the same way: if there is a broker,
 * queue it; if there is not, run it inline and say so. The alternative —
 * requiring Redis — would mean a department cannot run this without operating
 * a broker, and the alternative to *that* — silently dropping the work when
 * there is no broker — would leave cached standing and evidence counters
 * quietly wrong.
 *
 * Inline execution is slower for the caller, which is correct: a single-box
 * pilot should feel the cost of the work it is doing rather than lose it.
 */

const queues = new Map<string, Queue>();

async function getQueue(name: string): Promise<Queue | null> {
  const connection = await getQueueConnection();
  if (!connection) return null;

  const existing = queues.get(name);
  if (existing) return existing;

  const { Queue: BullQueue } = await import("bullmq");
  const queue = new BullQueue(name, { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS });
  queues.set(name, queue);
  return queue;
}

export type EnqueueResult = { queued: true; jobId: string } | { queued: false; ranInline: true };

async function enqueueOrRun(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  runInline: () => Promise<unknown>
): Promise<EnqueueResult> {
  const queue = await getQueue(queueName);

  if (!queue) {
    if (isQueueEnabled()) {
      // Configured but unreachable. Worth a log line: the operator believes
      // they have a queue and they do not.
      logger.warn("Queue configured but unavailable; running inline", { jobName });
    }
    await runInline();
    return { queued: false, ranInline: true };
  }

  try {
    const job = await queue.add(jobName, data);
    return { queued: true, jobId: job.id ?? jobName };
  } catch (error) {
    // Never lose the work because the broker blinked.
    logger.warn("Enqueue failed; running inline", { jobName, error: String(error) });
    await runInline();
    return { queued: false, ranInline: true };
  }
}

export async function enqueueMaintenance(job: MaintenanceJob): Promise<EnqueueResult> {
  const { runMaintenanceJob } = await import("./handlers");
  return enqueueOrRun(QUEUE_NAMES.maintenance, job.name, job.data, () => runMaintenanceJob(job));
}

export async function enqueueNotification(job: NotificationJob): Promise<EnqueueResult> {
  const { runNotificationJob } = await import("./handlers");
  return enqueueOrRun(QUEUE_NAMES.notifications, job.name, job.data, () =>
    runNotificationJob(job)
  );
}

/** For shutdown and tests. */
export async function closeQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close().catch(() => {});
  }
  queues.clear();
}
