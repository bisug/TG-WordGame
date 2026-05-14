import { Composer, InlineKeyboard } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";

const composer = new Composer();

composer.on("message", async (ctx, next) => {
  const userId = ctx.from.id.toString();
  const banKey = `ban:${userId}`;
  let isUserBanned: boolean;

  const cachedBan = await redis.get(banKey);
  if (cachedBan) {
    isUserBanned = cachedBan === "1";
  } else {
    const banRecord = await db
      .selectFrom("bannedUsers")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst();

    isUserBanned = !!banRecord;
    await redis.set(banKey, isUserBanned ? "1" : "0", "EX", 3600); // Cache for 1 hour
  }

  if (!isUserBanned) return await next();

  const keyboard = new InlineKeyboard();
  keyboard.url("Appeal", "t.me/binamralamsal").primary();
  const banMessage =
    "⚠️ You have been banned from bot for cheating using automated scripts!";

  if (ctx.chat.type === "private") {
    return ctx.reply(banMessage, {
      reply_markup: keyboard,
    });
  } else {
    const me = ctx.me.id.toString();

    const botMentioned =
      ctx.message.reply_to_message?.from?.id.toString() === me;

    if (botMentioned) {
      return ctx.reply(banMessage, {
        reply_markup: keyboard,
      });
    }
  }
});

export const handleBannedUsers = composer;
