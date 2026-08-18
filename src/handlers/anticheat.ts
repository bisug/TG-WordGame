import type { MiddlewareFn } from "grammy";
import { bot } from "../config/bot";
import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redis, safeGet, safeSet } from "../config/redis";
import { sendCaptchaChallenge } from "../util/captcha-challenge";
import { MemoryTtlCache } from "../util/memory-cache";

// Rate limit configuration
const RATE_LIMITS = {
  // Normal commands - generous limits for real users
  guess: { window: 60_000, max: 50 }, // 50 guesses per minute (very generous for active player)
  score: { window: 60_000, max: 40 },
  stats: { window: 60_000, max: 40 },

  // Admin/sensitive commands - stricter limits
  ban: { window: 60_000, max: 20 },
  captcha: { window: 60_000, max: 20 },
} as const;

type RateLimitKey = keyof typeof RATE_LIMITS;

// Fixed-window rate limit in a single atomic Redis round-trip. INCR + EXPIRE
// run together in Lua so concurrent requests can't race past the count check,
// and we read the TTL in the same call to report an accurate retry-after.
// Returns [count, ttlSeconds].
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
`;

/**
 * Check if user is rate limited
 * Returns { limited: true, retryAfter: ms } if limited, undefined otherwise.
 * Fail-open: any Redis error means "not limited" so an outage never blocks
 * real users from playing.
 */
async function checkRateLimit(
  userId: string,
  command: RateLimitKey,
): Promise<{ limited: boolean; retryAfter?: number }> {
  const config = RATE_LIMITS[command];
  const key = `ratelimit:${command}:${userId}`;

  try {
    const windowSeconds = Math.ceil(config.window / 1000);
    const result = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      windowSeconds,
    )) as [number, number];

    const count = Number(result?.[0] ?? 0);
    if (count <= config.max) {
      return { limited: false };
    }

    const ttl = Number(result?.[1] ?? -1);
    return {
      limited: true,
      retryAfter: ttl > 0 ? ttl * 1000 : config.window,
    };
  } catch (err) {
    logger.warn({ err, key }, "rate limit check failed, failing open");
    return { limited: false };
  }
}

/**
 * Middleware that rate limits commands for a specific user
 * Normal users won't hit these limits; only abusers will be affected
 */
export function rateLimit(command: RateLimitKey): MiddlewareFn {
  return async (ctx, next) => {
    if (!ctx.from) return await next();

    const userId = ctx.from.id.toString();
    const result = await checkRateLimit(userId, command);

    if (result.limited) {
      logger.debug({ userId, command }, "Rate limit exceeded");

      // Only respond to callback queries and commands
      if (ctx.callbackQuery) {
        return ctx.answerCallbackQuery({
          text: "⚠️ You're doing that too fast. Please wait a moment.",
          show_alert: true,
        });
      }

      if (ctx.message) {
        const retryAfter = Math.ceil((result.retryAfter || 5000) / 1000);
        return ctx.reply(
          `⏳ You're sending messages too quickly. Please wait ${retryAfter}s before trying again.`,
          { reply_parameters: { message_id: ctx.message.message_id } },
        );
      }

      return; // Silent drop for other update types
    }

    return await next();
  };
}

// Suspicious activity tracking - optimized with Redis hashes
const SUSPICIOUS_THRESHOLDS = {
  // Guesses faster than this (ms) are suspicious
  guessSpeedThreshold: 500, // Less than 500ms between guesses is inhuman
  maxSuspiciousGuesses: 5, // After 5 suspicious guesses, flag for review
  suspiciousDecayHours: 24, // Decay suspicious points after 24 hours
};

// Cache for user account age to avoid repeated DB queries. Bounded so a
// large influx of one-off users can't grow the cache without limit.
const userAgeCache = new MemoryTtlCache<number>(5 * 60 * 1000, 20_000);

/**
 * Track suspicious guess speed - optimized with Redis hashes
 * Real users take 1-5+ seconds between guesses
 * Bots are typically faster than 500ms
 */
export async function trackGuessSpeed(
  userId: string,
  chatId: string,
  topicId: string,
): Promise<void> {
  const key = `susp:${userId}`;
  const now = Date.now();

  try {
    // Get and update last guess time in a single round-trip:
    // SET ... GET atomically returns the previous value.
    const lastGuessKey = `lastguess:${chatId}:${topicId}:${userId}`;
    const lastGuessTime = await redis.set(
      lastGuessKey,
      now.toString(),
      "EX",
      3600, // Expire after 1 hour
      "GET",
    );
    const timeSinceLastGuess = lastGuessTime
      ? now - parseInt(lastGuessTime, 10)
      : now;

    const isSuspicious =
      lastGuessTime !== null &&
      timeSinceLastGuess < SUSPICIOUS_THRESHOLDS.guessSpeedThreshold;

    if (isSuspicious) {
      // Use Redis hash for atomic operations
      const pipeline = redis.pipeline();
      pipeline.hincrby(key, "fg", 1);
      pipeline.hset(key, "la", now.toString());
      pipeline.expire(key, SUSPICIOUS_THRESHOLDS.suspiciousDecayHours * 3600);

      const results = await pipeline.exec();
      const fastGuesses = (results?.[0]?.[1] as number) || 1;

      if (fastGuesses >= SUSPICIOUS_THRESHOLDS.maxSuspiciousGuesses) {
        // Increment total flagged, reset counter, and read the new total
        // in a single pipeline.
        const flagResults = await redis
          .pipeline()
          .hincrby(key, "tf", 1)
          .hset(key, "fg", "0") // Reset counter after flagging
          .hget(key, "tf")
          .exec();

        logger.warn(
          { userId, fastGuesses },
          "User flagged for suspicious activity",
        );

        await flagUserForReview(userId, "SPEED_BOT");

        // Auto-challenge: repeatedly flagged users get a captcha in the chat where
        // the suspicious activity happened. Cooldown prevents re-challenging on
        // every subsequent flag within the window.
        const totalFlagged = flagResults?.[2]?.[1] as number | string | null;
        if (totalFlagged && parseInt(String(totalFlagged), 10) >= 3) {
          const challengeCooldownKey = `autocaptcha:${userId}`;
          const recentlyChallenged = await safeGet(challengeCooldownKey);
          if (!recentlyChallenged) {
            await safeSet(challengeCooldownKey, "1", 3600);
            // Outcome notifications go to adminId, so it must be a real bot
            // admin — passing the suspect's own id DM'd the bot instead.
            const adminId = env.ADMIN_USERS[0]?.toString();
            if (!adminId) {
              logger.warn(
                { userId, chatId },
                "No ADMIN_USERS configured, skipping auto-captcha",
              );
            } else {
              const result = await sendCaptchaChallenge(
                chatId,
                userId,
                adminId,
              );
              if (result.ok) {
                logger.info(
                  { userId, chatId },
                  "Auto-challenged suspicious user with captcha",
                );
              }
            }
          }
        }
      }
    } else {
      // Decay the counter for normal users - use single pipeline.
      // HGET returns null when the key is missing, so no EXISTS round-trip.
      const fastGuesses = await redis.hget(key, "fg");
      if (fastGuesses && parseInt(fastGuesses, 10) > 0) {
        await redis
          .pipeline()
          .hincrby(key, "fg", -1)
          .expire(key, SUSPICIOUS_THRESHOLDS.suspiciousDecayHours * 3600)
          .exec();
      }
    }
  } catch (err) {
    // Anticheat tracking must never break gameplay: a Redis hiccup here
    // would otherwise swallow the user's already-inserted guess without a
    // reply. Fail open and skip tracking.
    logger.warn({ err, userId }, "trackGuessSpeed failed, skipping");
  }
}

/**
 * Flag a user for admin review - optimized with Redis hash.
 * Also notifies configured bot admins so flags are actually reviewed,
 * instead of only being written to Redis and forgotten.
 */
async function flagUserForReview(
  userId: string,
  reason: string,
): Promise<void> {
  const key = `flag:${userId}`;
  const timestamp = Date.now().toString();

  // Use Redis hash for efficient flag tracking. The HINCRBY result carries
  // the new count, so no extra round-trip to read it back.
  const pipeline = redis.pipeline();
  pipeline.hincrby(key, "count", 1);
  pipeline.hsetnx(key, "reasons", ""); // Initialize reasons list if not exists
  pipeline.hset(key, `reason:${timestamp}`, reason);
  pipeline.expire(key, 7 * 24 * 3600); // Keep for 7 days

  const results = await pipeline.exec();
  const count = results?.[0]?.[1] as number | string | null;
  logger.info({ userId, reason, totalFlags: count }, "User flagged for review");

  // Notify bot admins (best-effort, rate-limited to once per user per hour so
  // a spammer can't flood admin DMs).
  const notifiedKey = `flagnotify:${userId}`;
  const alreadyNotified = await safeGet(notifiedKey);
  if (alreadyNotified) return;
  await safeSet(notifiedKey, "1", 3600);

  for (const adminId of env.ADMIN_USERS) {
    try {
      await bot.api.sendMessage(
        adminId,
        `🚩 <b>User flagged for review</b>\n\n` +
          `User ID: <code>${userId}</code>\n` +
          `Reason: <code>${reason}</code>\n` +
          `Total flags: <code>${count ?? "?"}</code>\n\n` +
          `Challenge them with: /captcha &lt;chatId&gt; ${userId}`,
        { parse_mode: "HTML" },
      );
    } catch (err) {
      logger.warn({ err, adminId }, "Failed to notify admin about flag");
    }
  }
}

/**
 * Check if a user has been flagged - optimized with Redis hash
 */
export async function getUserFlags(userId: string): Promise<{
  count: number;
  reasons: Array<{ reason: string; timestamp: number }>;
} | null> {
  const key = `flag:${userId}`;

  try {
    // One HGETALL instead of EXISTS + HGET + HKEYS + one HGET per reason.
    // Returns {} for a missing key, so no separate existence check.
    const fields = await redis.hgetall(key);
    const count = fields.count;
    if (!count) return null;

    const reasons: Array<{ reason: string; timestamp: number }> = [];
    for (const [k, reason] of Object.entries(fields)) {
      if (k.startsWith("reason:")) {
        reasons.push({
          reason,
          timestamp: parseInt(k.slice("reason:".length), 10),
        });
      }
    }

    return { count: parseInt(count, 10), reasons };
  } catch (err) {
    // Fail open: unknown flags are treated as no flags so a Redis outage
    // never blocks legitimate users.
    logger.warn({ err, userId }, "getUserFlags failed, treating as unflagged");
    return null;
  }
}

/**
 * Get cached user account age (avoids repeated DB queries)
 */
async function getUserAccountAge(userId: string): Promise<number | null> {
  const cached = userAgeCache.get(userId);
  if (cached !== undefined) return cached;

  const user = await db
    .selectFrom("users")
    .select(["createdAt"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) return null;

  const age = Date.now() - new Date(user.createdAt).getTime();
  userAgeCache.set(userId, age);

  return age;
}

/**
 * Check if user should be challenged with captcha - optimized
 * Only challenges users with suspicious activity, not random new users
 */
export async function shouldChallengeUser(
  userId: string,
): Promise<{ challenge: boolean; reason?: string }> {
  // Check flags first (fast path - most users won't have flags)
  const flags = await getUserFlags(userId);
  if (flags && flags.count >= 2) {
    return { challenge: true, reason: "suspicious_activity" };
  }

  // Check for rapid account creation pattern (new users with suspicious behavior)
  const accountAge = await getUserAccountAge(userId);

  if (accountAge !== null) {
    const oneHour = 60 * 60 * 1000;

    // New accounts (< 1 hour) with fast guesses are suspicious
    if (accountAge < oneHour) {
      const fastGuesses = await redis.hget(`susp:${userId}`, "fg");
      if (fastGuesses && parseInt(fastGuesses, 10) >= 3) {
        return { challenge: true, reason: "new_account_suspicious" };
      }
    }
  }

  return { challenge: false };
}
