import { Composer } from "grammy";

import { env } from "../config/env";
import { redis } from "../config/redis";
import {
  getTrackingAdminChatId,
  setTrackedChat,
  unsetTrackedChat,
} from "../util/tracking-cache";

const composer = new Composer();

composer.command("track", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const chatId = ctx.match.trim();
  if (!chatId) {
    return ctx.reply("Usage: /track <chat_id>");
  }

  const existingTracking = await getTrackingAdminChatId(chatId);

  if (existingTracking) {
    return ctx.reply(`⚠️ Chat ${chatId} is already being tracked`);
  }

  await setTrackedChat(chatId, ctx.chat.id.toString());

  await ctx.reply(
    `✅ Now tracking chat: ${chatId}\nAll messages will be forwarded here.`,
  );
});

composer.command("untrack", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const chatId = ctx.match.trim();
  if (!chatId) {
    return ctx.reply("Usage: /untrack <chat_id>");
  }

  const deleted = await unsetTrackedChat(chatId);

  if (deleted === 0) {
    return ctx.reply(`⚠️ Chat ${chatId} is not being tracked`);
  }

  await ctx.reply(`✅ Stopped tracking chat: ${chatId}`);
});

composer.command("tracklist", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  // SCAN instead of KEYS: KEYS walks the whole keyspace in one blocking call.
  const keys: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      "MATCH",
      "tracking:*",
      "COUNT",
      200,
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  if (keys.length === 0) {
    return ctx.reply("No chats are currently being tracked");
  }

  const trackedChats = keys
    .map((key) => key.replace("tracking:", ""))
    .join("\n");
  await ctx.reply(`📋 Currently tracking:\n${trackedChats}`);
});

export const trackCommand = composer;
