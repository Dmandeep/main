import type { Redis } from "ioredis";
import { logger } from "@/lib/logger";

/**
 * The queue's Redis connection.
 *
 * Optional on purpose. The pilot runs on one box and may have no Redis at all;
 * an app that refuses to boot without a broker is an app a department cannot
 * install. Everything that enqueues therefore has an inline fallback, and this
 * module is the single place that answers "is there a queue?".
 *
 * Separate from the rate limiter's connection by design: a queue holds long
 * blocking reads (BRPOPLPUSH) which would otherwise sit in front of the
 * limiter's latency-sensitive INCR on the same socket.
 */

let connection: Redis | null = null;
let attempted = false;

export function queueRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function isQueueEnabled(): boolean {
  return queueRedisUrl() !== null;
}

/**
 * The shared connection, created once.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ: its blocking commands
 * must not be failed by the client's own retry cap, or workers die whenever
 * Redis pauses.
 */
export async function getQueueConnection(): Promise<Redis | null> {
  const url = queueRedisUrl();
  if (!url) return null;
  if (connection) return connection;
  if (attempted && !connection) return null;

  attempted = true;

  try {
    const { default: IORedis } = await import("ioredis");
    connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    connection.on("error", (error: Error) => {
      // Logged, not thrown: a broker that goes away must degrade the queue,
      // not take down request handling.
      logger.warn("Queue Redis error", { error: String(error) });
    });

    return connection;
  } catch (error) {
    logger.warn("Queue Redis unavailable; jobs will run inline", { error: String(error) });
    connection = null;
    return null;
  }
}

/** For worker shutdown and tests. */
export async function closeQueueConnection(): Promise<void> {
  if (!connection) return;
  await connection.quit().catch(() => connection?.disconnect());
  connection = null;
  attempted = false;
}
