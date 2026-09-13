import { Worker, type Job } from "bullmq";
import { logger } from "./src/lib/logger";
import { prisma } from "./src/lib/prisma";
import { closeQueueConnection, getQueueConnection } from "./src/lib/queue/connection";
import { QUEUE_NAMES } from "./src/lib/queue/jobs";
import { runMaintenanceJob, runNotificationJob } from "./src/lib/queue/handlers";
import type { MaintenanceJob, NotificationJob } from "./src/lib/queue/jobs";

/**
 * The background worker.
 *
 * A separate process from the web app on purpose: a long reconcile holding a
 * request thread is how a maintenance task becomes an outage. Run it with
 * `npm run worker`.
 *
 * Without REDIS_URL this exits immediately rather than idling. The app runs
 * fine in that configuration — every job has an inline fallback — so a worker
 * that silently pretends to be doing work would be worse than one that says it
 * has nothing to attach to.
 */

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);

/**
 * How often maintenance runs.
 *
 * Repeatable jobs are keyed by name, so restarting the worker re-registers the
 * same schedule rather than accumulating duplicates.
 */
const SCHEDULE = {
  reconcileEvidence: "*/15 * * * *",
  recomputeStanding: "0 * * * *",
  sweepWaitlists: "*/5 * * * *",
};

async function main() {
  const connection = await getQueueConnection();

  if (!connection) {
    logger.warn(
      "No REDIS_URL set, so there is no queue to consume. The app runs every job inline in this configuration; start Redis and set REDIS_URL to use a worker."
    );
    process.exit(0);
  }

  const maintenance = new Worker<MaintenanceJob["data"]>(
    QUEUE_NAMES.maintenance,
    async (job: Job) => runMaintenanceJob({ name: job.name, data: job.data } as MaintenanceJob),
    { connection, concurrency: CONCURRENCY }
  );

  const notifications = new Worker<NotificationJob["data"]>(
    QUEUE_NAMES.notifications,
    async (job: Job) => runNotificationJob({ name: job.name, data: job.data } as NotificationJob),
    { connection, concurrency: CONCURRENCY }
  );

  for (const worker of [maintenance, notifications]) {
    worker.on("failed", (job, error) => {
      logger.error("Job failed", {
        queue: worker.name,
        job: job?.name,
        attempt: job?.attemptsMade,
        error: String(error),
      });
    });
  }

  // Schedule the recurring work for every tenant that exists. Tenants are
  // added rarely enough that reading them at boot is fine; a tenant added
  // later is picked up on the next worker restart.
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });

  const { Queue } = await import("bullmq");
  const queue = new Queue(QUEUE_NAMES.maintenance, { connection });

  // Job ids use hyphens for the same reason queue names do: ":" is BullMQ's
  // key separator and a custom id containing one is rejected outright.
  for (const tenant of tenants) {
    await queue.add(
      "reconcile-evidence",
      { tenantId: tenant.id },
      { repeat: { pattern: SCHEDULE.reconcileEvidence }, jobId: `reconcile-${tenant.id}` }
    );
    await queue.add(
      "recompute-standing",
      { tenantId: tenant.id },
      { repeat: { pattern: SCHEDULE.recomputeStanding }, jobId: `recompute-${tenant.id}` }
    );
    await queue.add(
      "sweep-waitlists",
      { tenantId: tenant.id },
      { repeat: { pattern: SCHEDULE.sweepWaitlists }, jobId: `sweep-${tenant.id}` }
    );
  }

  logger.info("Worker ready", {
    queues: Object.values(QUEUE_NAMES),
    tenants: tenants.length,
    concurrency: CONCURRENCY,
  });

  async function shutdown(signal: string) {
    logger.info("Worker shutting down", { signal });
    // Close workers first so in-flight jobs finish before the connection goes.
    await Promise.all([maintenance.close(), notifications.close()]);
    await queue.close();
    await closeQueueConnection();
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  logger.error("Worker failed to start", { error: String(error) });
  process.exit(1);
});
