import { Queue, Worker } from "bullmq";

import { bot } from "../config/bot";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { captchaSchema } from "../schemas";
import { formatUserMention } from "../commands/captcha";
import { safeJsonParse } from "../util/safe-json-parse";

// Bullmq bundles its own copy of ioredis, so passing our shared ioredis
// instance would cross two module copies and fail type-checking. We instead
// hand bullmq plain connection options (same target Redis) to keep a single
// source of truth for the connection and stay on the latest ioredis.
function getRedisConnectionOptions() {
  const url = new URL(env.REDIS_URI);
  const useTls = url.protocol === "rediss:";
  return {
    host: url.hostname || "127.0.0.1",
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db:
      url.pathname && url.pathname !== "/"
        ? Number(url.pathname.replace(/^\//, ""))
        : undefined,
    ...(useTls ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

const connection = getRedisConnectionOptions();

export const captchaQueue = new Queue("captcha-expiry", {
  connection,
  skipVersionCheck: true,
});

export const captchaWorker = new Worker(
  "captcha-expiry",
  async (job) => {
    const { chatId, userId, messageId } = job.data;

    const key = `captcha:${chatId}:${userId}`;
    const raw = await redis.get(key);

    if (!raw) return;

    const sessionResult = captchaSchema.safeParse(safeJsonParse(raw, null));
    if (!sessionResult.success) {
      await redis.del(key);
      return;
    }

    const session = sessionResult.data;

    await redis.del(key);

    const mention = formatUserMention({
      id: session.userId,
      name: session.name,
      username: session.username,
    });

    try {
      await bot.api.editMessageText(
        chatId,
        messageId,
        `⏰ <b>Verification timed out</b>\n\n${mention} didn’t complete it in time.`,
        { parse_mode: "HTML" },
      );
    } catch (e) {
      logger.error(
        { err: e, chatId, messageId },
        "Edit timeout message failed",
      );
    }

    try {
      await bot.api.sendMessage(
        session.adminId,
        `⏰ ${mention} did not complete the captcha in time.`,
        { parse_mode: "HTML" },
      );
    } catch (e) {
      logger.error(
        { err: e, adminId: session.adminId },
        "Admin captcha notify failed",
      );
    }
  },
  {
    connection,
    skipVersionCheck: true,
    // Keep the Redis keyspace bounded: drop finished jobs after an hour and
    // failed jobs after a week instead of retaining them forever.
    removeOnComplete: { age: 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600, count: 5000 },
  },
);

captchaWorker.on("failed", (job, err) => {
  logger.error({ err, jobId: job?.id }, "Captcha expiry job failed");
});

captchaWorker.on("error", (err) => {
  logger.error({ err }, "Captcha expiry worker error");
});
