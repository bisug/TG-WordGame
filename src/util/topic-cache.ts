import { db } from "../config/db";
import { MemoryTtlCache } from "./memory-cache";
import { safeJsonParse } from "./safe-json-parse";
import type { WordLength } from "./word-selector";
import { safeDel, safeGet, safeSet } from "../config/redis";

const CACHE_TTL = 3600 * 24; // 24 hours
const MEMORY_CACHE_TTL_MS = 60 * 1000;

export type CachedTopic = {
  chatId: string;
  topicId: string;
  allowedLengths: unknown;
};

const memoryCache = new MemoryTtlCache<CachedTopic[]>(MEMORY_CACHE_TTL_MS);

export async function getCachedTopics(chatId: string): Promise<CachedTopic[]> {
  const key = `topics:${chatId}`;
  const memoryValue = memoryCache.get(key);
  if (memoryValue) return memoryValue;

  const cached = await safeGet(key);

  if (cached) {
    const parsed = safeJsonParse<CachedTopic[] | undefined>(cached, undefined);
    if (parsed) {
      memoryCache.set(key, parsed);
      return parsed;
    }
    await safeDel(key);
  }

  // Cache miss, query DB
  const topics = await db
    .selectFrom("chatGameTopics")
    .selectAll()
    .where("chatId", "=", chatId)
    .execute();

  await safeSet(key, JSON.stringify(topics), CACHE_TTL);
  memoryCache.set(key, topics);
  return topics;
}

export async function invalidateTopicsCache(chatId: string) {
  const key = `topics:${chatId}`;
  memoryCache.delete(key);
  await safeDel(key);
}
