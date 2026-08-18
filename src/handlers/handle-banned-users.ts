import { Composer, InlineKeyboard } from "grammy";

import { env } from "../config/env";
import { getCachedBanStatus } from "../util/ban-cache";

const composer = new Composer();

composer.on("message", async (ctx, next) => {
  // Anonymous admin posts and channel auto-forwards carry no `from`.
  if (!ctx.from) return await next();

  const userId = ctx.from.id.toString();
  const isUserBanned = await getCachedBanStatus(userId);

  if (!isUserBanned) return await next();

  const keyboard = new InlineKeyboard();
  keyboard.url("Appeal Ban", env.BAN_APPEAL_URL).primary();

  // Friendly, less accusatory message with clear appeal path
  const banMessage =
    "⛔ <b>Access Restricted</b>\n\n" +
    "Your access to this bot has been restricted.\n\n" +
    "If you believe this was a mistake or would like to appeal, tap the button below to contact support.";

  if (ctx.chat.type === "private") {
    return ctx.reply(banMessage, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  } else {
    const me = ctx.me.id.toString();

    const botMentioned =
      ctx.message.reply_to_message?.from?.id.toString() === me;

    if (botMentioned) {
      return ctx.reply(banMessage, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
  }
});

export const handleBannedUsers = composer;
