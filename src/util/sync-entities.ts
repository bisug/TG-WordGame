import { db } from "../config/db";
import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { MemoryTtlCache } from "./memory-cache";

type SyncUser = {
  id: number | string;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
};

type SyncChat = {
  id: number | string;
  type: string;
  title?: string;
  first_name?: string;
  username?: string;
};

export type SyncedUser = {
  id: string;
  name: string;
  username: string | null;
};

// Bounded so a long-running process doesn't grow memory without limit as it
// sees new users/chats (1h TTL, keyed by id).
const userSyncMemory = new MemoryTtlCache<boolean>(60 * 60 * 1000, 50_000);
const chatSyncMemory = new MemoryTtlCache<boolean>(60 * 60 * 1000, 50_000);

function getUserData(user: SyncUser): SyncedUser {
  return {
    id: user.id.toString(),
    name: user.first_name + (user.last_name ? ` ${user.last_name}` : ""),
    username: user.username || null,
  };
}

export async function ensureUser(user: SyncUser | undefined | null) {
  if (!user || user.is_bot) return null;

  const userData = getUserData(user);
  const syncKey = `sync:user:${userData.id}`;

  try {
    if (userSyncMemory.get(syncKey)) return userData;

    try {
      if (await redis.get(syncKey)) {
        userSyncMemory.set(syncKey, true);
        return userData;
      }
    } catch (error) {
      logger.warn({ err: error, userId: userData.id }, "User sync cache miss");
    }

    await db
      .insertInto("users")
      .values(userData)
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          name: userData.name,
          username: userData.username,
        }),
      )
      .execute();

    await redis.set(syncKey, "1", "EX", 3600 * 24).catch((error) => {
      logger.warn({ err: error, userId: userData.id }, "User sync cache set");
    });
    userSyncMemory.set(syncKey, true);
    return userData;
  } catch (error) {
    logger.error({ err: error, userId: userData.id }, "Error in user sync");
    throw error;
  }
}

export async function ensureChat(
  chat: SyncChat | undefined | null,
  user?: SyncUser,
) {
  if (!chat || chat.type === "channel") return null;

  const chatId = chat.id.toString();
  const chatName =
    chat.type === "private"
      ? user
        ? user.first_name + (user.last_name ? ` ${user.last_name}` : "")
        : chat.first_name || null
      : chat.title || null;
  const chatUsername = chat.username || null;
  const syncKey = `sync:chat:${chatId}`;

  try {
    if (chatSyncMemory.get(syncKey)) {
      return { id: chatId, name: chatName, username: chatUsername };
    }

    try {
      if (await redis.get(syncKey)) {
        chatSyncMemory.set(syncKey, true);
        return { id: chatId, name: chatName, username: chatUsername };
      }
    } catch (error) {
      logger.warn({ err: error, chatId }, "Chat sync cache miss");
    }

    await db
      .insertInto("broadcastChats")
      .values({
        id: chatId,
        name: chatName,
        username: chatUsername,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          name: chatName,
          username: chatUsername,
        }),
      )
      .execute();

    await redis.set(syncKey, "1", "EX", 3600 * 24).catch((error) => {
      logger.warn({ err: error, chatId }, "Chat sync cache set");
    });
    chatSyncMemory.set(syncKey, true);
    return { id: chatId, name: chatName, username: chatUsername };
  } catch (error) {
    logger.error({ err: error, chatId }, "Error in chat sync");
    throw error;
  }
}
