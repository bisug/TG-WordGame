import { db } from "../config/db";
import { redis } from "../config/redis";
import { MemoryTtlCache } from "./memory-cache";
import { safeJsonParse } from "./safe-json-parse";

const CACHE_TTL = 3600 * 24; // 24 hours
const MEMORY_CACHE_TTL_MS = 60 * 1000;

export type CachedGame = {
  id: number;
  word: string;
  activeChat: string;
  topicId: string;
  startedBy: string | null;
} | null;

const memoryCache = new MemoryTtlCache<CachedGame>(MEMORY_CACHE_TTL_MS);

export async function getCachedGame(
  chatId: string,
  topicId: string,
): Promise<CachedGame | undefined> {
  const key = `game:${chatId}:${topicId}`;
  const memoryValue = memoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const cached = await redis.get(key);

  if (cached === "none") {
    memoryCache.set(key, null, 5_000);
    return null;
  }
  if (cached) {
    const parsed = safeJsonParse<CachedGame | undefined>(cached, undefined);
    if (parsed !== undefined) {
      memoryCache.set(key, parsed);
      return parsed;
    }
    await redis.del(key);
  }

  // Cache miss, query DB
  const game = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", chatId)
    .where("topicId", "=", topicId)
    .executeTakeFirst();

  if (game) {
    await redis.set(key, JSON.stringify(game), "EX", CACHE_TTL);
    memoryCache.set(key, game);
    return game;
  } else {
    await redis.set(key, "none", "EX", 300); // 5 minutes negative cache
    memoryCache.set(key, null, 5_000);
    return null;
  }
}

export async function setCachedGame(
  chatId: string,
  topicId: string,
  game: NonNullable<CachedGame>,
) {
  const key = `game:${chatId}:${topicId}`;
  memoryCache.set(key, game);
  await redis.set(key, JSON.stringify(game), "EX", CACHE_TTL);
}

export async function deleteCachedGame(chatId: string, topicId: string) {
  const key = `game:${chatId}:${topicId}`;
  memoryCache.delete(key);
  await redis.del(key);
}
