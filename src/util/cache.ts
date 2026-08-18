import { db } from "../config/db";
import { logger } from "../config/logger";
import { redis, safeDel, safeGet, safeSet } from "../config/redis";
import { toUtcMidnight } from "../services/daily-wordle-cron";
import { safeJsonParse } from "./formatting";
import { MemoryTtlCache } from "./memory-cache";

// Ban Cache
const BAN_CACHE_SECONDS = 3600;
const banMemoryCache = new MemoryTtlCache<boolean>(60 * 1000, 20_000);

export async function getCachedBanStatus(userId: string) {
  const key = `ban:${userId}`;
  const memoryValue = banMemoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const cachedBan = await safeGet(key);
  if (cachedBan) {
    const isBanned = cachedBan === "1";
    banMemoryCache.set(key, isBanned);
    return isBanned;
  }

  const banRecord = await db
    .selectFrom("bannedUsers")
    .select("userId")
    .where("userId", "=", userId)
    .executeTakeFirst();

  const isBanned = !!banRecord;
  await setCachedBanStatus(userId, isBanned);
  return isBanned;
}

export async function setCachedBanStatus(userId: string, isBanned: boolean) {
  const key = `ban:${userId}`;
  banMemoryCache.set(key, isBanned);
  await safeSet(key, isBanned ? "1" : "0", BAN_CACHE_SECONDS);
}

// Topic Cache
export type CachedTopic = {
  chatId: string;
  topicId: string;
  allowedLengths: unknown;
};

const topicMemoryCache = new MemoryTtlCache<CachedTopic[]>(60 * 1000, 10_000);

export async function getCachedTopics(chatId: string): Promise<CachedTopic[]> {
  const key = `topics:${chatId}`;
  const memoryValue = topicMemoryCache.get(key);
  if (memoryValue) return memoryValue;

  const cached = await safeGet(key);

  if (cached) {
    const parsed = safeJsonParse<CachedTopic[] | undefined>(cached, undefined);
    if (parsed) {
      topicMemoryCache.set(key, parsed);
      return parsed;
    }
    await safeDel(key);
  }

  const topics = await db
    .selectFrom("chatGameTopics")
    .selectAll()
    .where("chatId", "=", chatId)
    .execute();

  await safeSet(key, JSON.stringify(topics), 3600 * 24);
  topicMemoryCache.set(key, topics);
  return topics;
}

export async function invalidateTopicsCache(chatId: string) {
  const key = `topics:${chatId}`;
  topicMemoryCache.delete(key);
  await safeDel(key);
}

// Tracking Cache
const trackingMemoryCache = new MemoryTtlCache<string | null>(
  60 * 1000,
  10_000,
);

export async function getTrackingAdminChatId(chatId: string | number) {
  const key = `tracking:${chatId}`;
  const memoryValue = trackingMemoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const adminChatId = await safeGet(key);
  if (adminChatId) {
    trackingMemoryCache.set(key, adminChatId);
    return adminChatId;
  }

  trackingMemoryCache.set(key, null, 15 * 1000);
  return null;
}

export async function setTrackedChat(
  chatId: string | number,
  adminChatId: string,
) {
  const key = `tracking:${chatId}`;
  trackingMemoryCache.set(key, adminChatId);
  await safeSet(key, adminChatId);
}

export async function unsetTrackedChat(chatId: string | number) {
  const key = `tracking:${chatId}`;
  trackingMemoryCache.set(key, null, 15 * 1000);
  return safeDel(key);
}

// Game Cache
export type CachedGame = {
  id: number;
  word: string;
  activeChat: string;
  topicId: string;
  startedBy: string | null;
} | null;

const gameMemoryCache = new MemoryTtlCache<CachedGame>(60 * 1000, 10_000);
const gameInflight = new Map<string, Promise<CachedGame | undefined>>();

export async function getCachedGame(
  chatId: string,
  topicId: string,
): Promise<CachedGame | undefined> {
  const key = `game:${chatId}:${topicId}`;
  const memoryValue = gameMemoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const existing = gameInflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cached = await safeGet(key);

    if (cached === "none") {
      gameMemoryCache.set(key, null, 60 * 1000);
      return null;
    }
    if (cached) {
      const parsed = safeJsonParse<CachedGame | undefined>(cached, undefined);
      if (parsed !== undefined) {
        gameMemoryCache.set(key, parsed);
        return parsed;
      }
      await safeDel(key);
    }

    const game = await db
      .selectFrom("games")
      .selectAll()
      .where("activeChat", "=", chatId)
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    if (game) {
      await safeSet(key, JSON.stringify(game), 3600 * 24);
      gameMemoryCache.set(key, game);
      return game;
    } else {
      await safeSet(key, "none", 1800);
      gameMemoryCache.set(key, null, 60 * 1000);
      return null;
    }
  })();

  gameInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    gameInflight.delete(key);
  }
}

export async function setCachedGame(
  chatId: string,
  topicId: string,
  game: NonNullable<CachedGame>,
) {
  const key = `game:${chatId}:${topicId}`;
  gameMemoryCache.set(key, game);
  await safeSet(key, JSON.stringify(game), 3600 * 24);
}

export async function deleteCachedGame(chatId: string, topicId: string) {
  const key = `game:${chatId}:${topicId}`;
  gameMemoryCache.delete(key);
  await safeDel(key);
  // Also drop the participant set used for the end-game vote threshold.
  await safeDel(getPlayersKey(chatId, topicId));
}

// Player tracking for the end-game vote. Players are recorded when they make
// a guess (or start the game) so the vote threshold can scale with the actual
// number of participants instead of a hardcoded 3, which is unreachable in
// 1-2 person groups.
const PLAYER_SET_TTL_SECONDS = 3600 * 24;

function getPlayersKey(chatId: string, topicId: string) {
  return `players:${chatId}:${topicId}`;
}

export async function addGamePlayer(
  chatId: string,
  topicId: string,
  userId: string,
): Promise<void> {
  try {
    const pipe = redis.pipeline();
    pipe.sadd(getPlayersKey(chatId, topicId), userId);
    pipe.expire(getPlayersKey(chatId, topicId), PLAYER_SET_TTL_SECONDS);
    await pipe.exec();
  } catch (err) {
    logger.warn({ err, chatId, topicId }, "redis sadd players failed");
  }
}

export async function getGamePlayerCount(
  chatId: string,
  topicId: string,
): Promise<number> {
  try {
    return await redis.scard(getPlayersKey(chatId, topicId));
  } catch (err) {
    logger.warn({ err, chatId, topicId }, "redis scard players failed");
    return 0;
  }
}

// Daily Word Cache
export type CachedDailyWord = {
  id: number;
  date: Date;
  dayNumber: number;
  word: string;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
};

const dailyWordMemoryCache = new MemoryTtlCache<CachedDailyWord>(
  60 * 60 * 1000,
); // 1 hour

export async function getCachedDailyWord(
  dateKey: string,
): Promise<CachedDailyWord | undefined> {
  const key = `dailyWord:${dateKey}`;
  const memoryValue = dailyWordMemoryCache.get(key);
  if (memoryValue) return memoryValue;

  const cached = await safeGet(key);
  if (cached) {
    const parsed = safeJsonParse<CachedDailyWord | undefined>(
      cached,
      undefined,
    );
    if (parsed) {
      dailyWordMemoryCache.set(key, parsed);
      return parsed;
    }
    await safeDel(key);
  }

  const dailyWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", toUtcMidnight(dateKey))
    .executeTakeFirst();

  if (dailyWord) {
    const cachedWord: CachedDailyWord = {
      id: dailyWord.id,
      date: dailyWord.date,
      dayNumber: dailyWord.dayNumber,
      word: dailyWord.word,
      meaning: dailyWord.meaning ?? null,
      phonetic: dailyWord.phonetic ?? null,
      sentence: dailyWord.sentence ?? null,
    };
    await safeSet(key, JSON.stringify(cachedWord), 24 * 60 * 60); // 24 hours
    dailyWordMemoryCache.set(key, cachedWord);
    return cachedWord;
  }

  return undefined;
}
