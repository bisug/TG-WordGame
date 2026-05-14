import { db } from "../config/db";
import { redis } from "../config/redis";
import type { WordLength } from "./word-selector";

const CACHE_TTL = 3600 * 24; // 24 hours

export type CachedTopic = {
  chatId: string;
  topicId: string;
  allowedLengths: unknown;
};

export async function getCachedTopics(chatId: string): Promise<CachedTopic[]> {
  const key = `topics:${chatId}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return JSON.parse(cached) as CachedTopic[];
  }

  // Cache miss, query DB
  const topics = await db
    .selectFrom("chatGameTopics")
    .selectAll()
    .where("chatId", "=", chatId)
    .execute();

  await redis.set(key, JSON.stringify(topics), "EX", CACHE_TTL);
  return topics;
}

export async function invalidateTopicsCache(chatId: string) {
  const key = `topics:${chatId}`;
  await redis.del(key);
}
