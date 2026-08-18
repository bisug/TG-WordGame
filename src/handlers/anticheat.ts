import type { MiddlewareFn } from "grammy";
import { bot } from "../config/bot";
import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redis, safeGet, safeSet } from "../config/redis";
import { sendCaptchaChallenge } from "../util/captcha-challenge";

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
    const current = await safeGet(key);

    if (!current) {
      await safeSet(key, "1", Math.ceil(config.window / 1000));
      return { limited: false };
    }

    const count = parseInt(current, 10);

    if (count >= config.max) {
      // Calculate when the oldest request will expire
      const ttl = await redis.ttl(key);
      return {
        limited: true,
        retryAfter: ttl > 0 ? ttl * 1000 : config.window,
      };
    }

    // Use INCR directly - Redis handles non-existent keys automatically
    await redis.incr(key);
    return { limited: false };
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

// Cache for user account age to avoid repeated DB queries
const userAgeCache = new Map<string, { age: number; cachedAt: number }>();
const USER_AGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  // Get last guess time from Redis
  const lastGuessKey = `lastguess:${chatId}:${topicId}:${userId}`;
  const lastGuessTime = await redis.get(lastGuessKey);
  const timeSinceLastGuess = lastGuessTime
    ? now - parseInt(lastGuessTime, 10)
    : now;

  // Update last guess time
  await redis.set(lastGuessKey, now.toString(), "EX", 3600); // Expire after 1 hour

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
      // Increment total flagged
      await redis
        .pipeline()
        .hincrby(key, "tf", 1)
        .hset(key, "fg", "0") // Reset counter after flagging
        .exec();

      logger.warn(
        { userId, fastGuesses },
        "User flagged for suspicious activity",
      );

      await flagUserForReview(userId, "SPEED_BOT");

      // Auto-challenge: repeatedly flagged users get a captcha in the chat where
      // the suspicious activity happened. Cooldown prevents re-challenging on
      // every subsequent flag within the window.
      const totalFlagged = await redis.hget(key, "tf");
      if (totalFlagged && parseInt(totalFlagged, 10) >= 3) {
        const challengeCooldownKey = `autocaptcha:${userId}`;
        const recentlyChallenged = await safeGet(challengeCooldownKey);
        if (!recentlyChallenged) {
          await safeSet(challengeCooldownKey, "1", 3600);
          const result = await sendCaptchaChallenge(chatId, userId, userId);
          if (result.ok) {
            logger.info(
              { userId, chatId },
              "Auto-challenged suspicious user with captcha",
            );
          }
        }
      }
    }
  } else {
    // Decay the counter for normal users - use single pipeline
    const exists = await redis.exists(key);
    if (exists) {
      const fastGuesses = await redis.hget(key, "fg");
      if (fastGuesses && parseInt(fastGuesses, 10) > 0) {
        await redis
          .pipeline()
          .hincrby(key, "fg", -1)
          .expire(key, SUSPICIOUS_THRESHOLDS.suspiciousDecayHours * 3600)
          .exec();
      }
    }
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

  // Use Redis hash for efficient flag tracking
  const pipeline = redis.pipeline();
  pipeline.hincrby(key, "count", 1);
  pipeline.hsetnx(key, "reasons", ""); // Initialize reasons list if not exists
  pipeline.hset(key, `reason:${timestamp}`, reason);
  pipeline.expire(key, 7 * 24 * 3600); // Keep for 7 days

  await pipeline.exec();

  const count = await redis.hget(key, "count");
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
  const exists = await redis.exists(key);

  if (!exists) return null;

  const count = await redis.hget(key, "count");
  if (!count) return null;

  // Get all reason entries
  const allKeys = await redis.hkeys(key);
  const reasons: Array<{ reason: string; timestamp: number }> = [];

  for (const k of allKeys) {
    if (k.startsWith("reason:")) {
      const timestamp = parseInt(k.replace("reason:", ""), 10);
      const reason = await redis.hget(key, k);
      if (reason) {
        reasons.push({ reason, timestamp });
      }
    }
  }

  return { count: parseInt(count, 10), reasons };
}

/**
 * Get cached user account age (avoids repeated DB queries)
 */
async function getUserAccountAge(userId: string): Promise<number | null> {
  const now = Date.now();

  // Check cache first
  const cached = userAgeCache.get(userId);
  if (cached && now - cached.cachedAt < USER_AGE_CACHE_TTL) {
    return cached.age;
  }

  // Query DB
  const user = await db
    .selectFrom("users")
    .select(["createdAt"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!user) return null;

  const age = now - new Date(user.createdAt).getTime();

  // Cache the result
  userAgeCache.set(userId, { age, cachedAt: now });

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
