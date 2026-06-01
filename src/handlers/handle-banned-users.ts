import { Composer, InlineKeyboard } from "grammy";

import { getCachedBanStatus } from "../util/ban-cache";

const composer = new Composer();

composer.on("message", async (ctx, next) => {
  const userId = ctx.from.id.toString();
  const isUserBanned = await getCachedBanStatus(userId);

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
