import { Composer } from "grammy";

import { db } from "../config/db";
import { logger } from "../config/logger";
import { redis } from "../config/redis";

const composer = new Composer();

composer.use(async (ctx, next) => {
  try {
    const user = ctx.from;
    const chat = ctx.chat;

    if (user && !user.is_bot) {
      const userId = user.id.toString();
      const userName =
        user.first_name + (user.last_name ? " " + user.last_name : "");
      const userUsername = user.username || null;

      (async () => {
        try {
          const syncKey = `sync:user:${userId}`;
          if (await redis.get(syncKey)) return;
          await redis.set(syncKey, "1", "EX", 3600 * 24); // Sync once a day

          await db
            .insertInto("users")
            .values({
              id: userId,
              name: userName,
              username: userUsername,
            })
            .onConflict((oc) =>
              oc.column("id").doUpdateSet({
                name: userName,
                username: userUsername,
              }),
            )
            .execute();
        } catch (error) {
          logger.error({ err: error, userId }, "Error in user sync");
        }
      })();
    }

    if (chat && chat.type !== "channel") {
      const chatId = chat.id.toString();
      const chatName =
        chat.type === "private"
          ? user
            ? user.first_name + (user.last_name ? " " + user.last_name : "")
            : null
          : chat.title;
      const chatUsername = chat.username || null;

      (async () => {
        try {
          const syncKey = `sync:chat:${chatId}`;
          if (await redis.get(syncKey)) return;
          await redis.set(syncKey, "1", "EX", 3600 * 24); // Sync once a day

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
        } catch (error) {
          logger.error({ err: error, chatId: chat.id }, "Error in chat sync");
        }
      })();
    }
  } catch (error) {
    logger.error({ err: error }, "Error in sync middleware");
  }

  return next();
});

export const userAndChatSyncHandler = composer;
