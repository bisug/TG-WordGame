import { db } from "../config/db";
import { MemoryTtlCache } from "./memory-cache";
import { safeJsonParse } from "./safe-json-parse";
import { safeDel, safeGet, safeSet } from "../config/redis";

const CACHE_TTL = 3600 * 24; // 24 hours
const MEMORY_CACHE_TTL_MS = 60 * 1000;
const NEGATIVE_MEMORY_TTL_MS = 60 * 1000;
const NEGATIVE_REDIS_TTL = 1800; // 30 minutes

export type CachedGame = {
  id: number;
  word: string;
  activeChat: string;
  topicId: string;
  startedBy: string | null;
} | null;

const memoryCache = new MemoryTtlCache<CachedGame>(MEMORY_CACHE_TTL_MS);
// Collapse concurrent same-key misses into a single fetch so a burst of guesses
// on a not-yet-cached game issues one redis GET / one DB query, not N.
const inflight = new Map<string, Promise<CachedGame | undefined>>();

export async function getCachedGame(
  chatId: string,
  topicId: string,
): Promise<CachedGame | undefined> {
  const key = `game:${chatId}:${topicId}`;
  const memoryValue = memoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const cached = await safeGet(key);

    if (cached === "none") {
      memoryCache.set(key, null, NEGATIVE_MEMORY_TTL_MS);
      return null;
    }
    if (cached) {
      const parsed = safeJsonParse<CachedGame | undefined>(cached, undefined);
      if (parsed !== undefined) {
        memoryCache.set(key, parsed);
        return parsed;
      }
      await safeDel(key);
    }

    // Cache miss, query DB
    const game = await db
      .selectFrom("games")
      .selectAll()
      .where("activeChat", "=", chatId)
      .where("topicId", "=", topicId)
      .executeTakeFirst();

    if (game) {
      await safeSet(key, JSON.stringify(game), CACHE_TTL);
      memoryCache.set(key, game);
      return game;
    } else {
      await safeSet(key, "none", NEGATIVE_REDIS_TTL);
      memoryCache.set(key, null, NEGATIVE_MEMORY_TTL_MS);
      return null;
    }
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export async function setCachedGame(
  chatId: string,
  topicId: string,
  game: NonNullable<CachedGame>,
) {
  const key = `game:${chatId}:${topicId}`;
  memoryCache.set(key, game);
  await safeSet(key, JSON.stringify(game), CACHE_TTL);
}

export async function deleteCachedGame(chatId: string, topicId: string) {
  const key = `game:${chatId}:${topicId}`;
  memoryCache.delete(key);
  await safeDel(key);
}
