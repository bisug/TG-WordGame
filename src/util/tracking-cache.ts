import { MemoryTtlCache } from "./memory-cache";
import { safeDel, safeGet, safeSet } from "../config/redis";

const POSITIVE_CACHE_MS = 60 * 1000;
const NEGATIVE_CACHE_MS = 15 * 1000;
const memoryCache = new MemoryTtlCache<string | null>(POSITIVE_CACHE_MS);

function keyFor(chatId: string | number) {
  return `tracking:${chatId}`;
}

export async function getTrackingAdminChatId(chatId: string | number) {
  const key = keyFor(chatId);
  const memoryValue = memoryCache.get(key);
  if (memoryValue !== undefined) return memoryValue;

  const adminChatId = await safeGet(key);
  if (adminChatId) {
    memoryCache.set(key, adminChatId);
    return adminChatId;
  }

  memoryCache.set(key, null, NEGATIVE_CACHE_MS);
  return null;
}

export async function setTrackedChat(
  chatId: string | number,
  adminChatId: string,
) {
  const key = keyFor(chatId);
  memoryCache.set(key, adminChatId);
  await safeSet(key, adminChatId);
}

export async function unsetTrackedChat(chatId: string | number) {
  const key = keyFor(chatId);
  memoryCache.set(key, null, NEGATIVE_CACHE_MS);
  return safeDel(key);
}
