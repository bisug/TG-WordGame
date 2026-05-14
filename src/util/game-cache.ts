import { db } from "../config/db";
import { redis } from "../config/redis";

const CACHE_TTL = 3600 * 24; // 24 hours

export type CachedGame = {
  id: number;
  word: string;
  activeChat: string;
  topicId: string;
  startedBy: string | null;
} | null;

export async function getCachedGame(
  chatId: string,
  topicId: string,
): Promise<CachedGame | undefined> {
  const key = `game:${chatId}:${topicId}`;
  const cached = await redis.get(key);

  if (cached === "none") return null;
  if (cached) return JSON.parse(cached) as CachedGame;

  // Cache miss, query DB
  const game = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", chatId)
    .where("topicId", "=", topicId)
    .executeTakeFirst();

  if (game) {
    await redis.set(key, JSON.stringify(game), "EX", CACHE_TTL);
    return game;
  } else {
    await redis.set(key, "none", "EX", 300); // 5 minutes negative cache
    return null;
  }
}

export async function setCachedGame(
  chatId: string,
  topicId: string,
  game: NonNullable<CachedGame>,
) {
  const key = `game:${chatId}:${topicId}`;
  await redis.set(key, JSON.stringify(game), "EX", CACHE_TTL);
}

export async function deleteCachedGame(chatId: string, topicId: string) {
  const key = `game:${chatId}:${topicId}`;
  await redis.del(key);
}
