import { db } from "../config/db";
import { redis } from "../config/redis";
import { MemoryTtlCache } from "./memory-cache";

const CACHE_SECONDS = 3600;
const memoryCache = new MemoryTtlCache<boolean>(60 * 1000);

function keyFor(userId: string) {
  return `ban:${userId}`;
}

export async function getCachedBanStatus(userId: string) {
  const key = keyFor(userId);
  const memoryValue = memoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const cachedBan = await redis.get(key);
  if (cachedBan) {
    const isBanned = cachedBan === "1";
    memoryCache.set(key, isBanned);
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
  const key = keyFor(userId);
  memoryCache.set(key, isBanned);
  await redis.set(key, isBanned ? "1" : "0", "EX", CACHE_SECONDS);
}
