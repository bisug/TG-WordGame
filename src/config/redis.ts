import IORedis from "ioredis";

import { env } from "./env";
import { logger } from "./logger";

// Bounded, fail-fast connection. A single socket is kept on purpose: the
// vote-to-end logic relies on one connection and bullmq owns its own separate
// client (which keeps maxRetriesPerRequest:null). If a command can't complete
// it rejects quickly instead of stalling the whole update pipeline forever.
const retryStrategy = (times: number) => Math.min(times * 200, 5000);

export const redis = new IORedis(env.REDIS_URI, {
  maxRetriesPerRequest: 2,
  commandTimeout: 2000,
  connectTimeout: 10000,
  enableOfflineQueue: false,
  retryStrategy,
});

// Safe wrappers so a Redis outage degrades to the DB/cache-miss path instead of
// throwing and killing the update. Reads return null (treated as a miss);
// writes are swallowed. Keep these thin — latency-sensitive callers rely on them.
export async function safeGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    logger.warn({ err, key }, "redis get failed, falling back");
    return null;
  }
}

export async function safeSet(
  key: string,
  value: string,
  exSeconds?: number,
): Promise<void> {
  try {
    if (exSeconds) await redis.set(key, value, "EX", exSeconds);
    else await redis.set(key, value);
  } catch (err) {
    logger.warn({ err, key }, "redis set failed");
  }
}

export async function safeDel(key: string): Promise<number> {
  try {
    return await redis.del(key);
  } catch (err) {
    logger.warn({ err, key }, "redis del failed");
    return 0;
  }
}
