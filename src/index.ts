import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";

import { env } from "./config/env";


import { bot } from "./config/bot";
import { logger } from "./config/logger";
import { commands } from "./commands";
import { errorHandler } from "./handlers/error-handler";
import { onMessageHander } from "./handlers/on-message";
import { CommandsHelper } from "./util/commands-helper";
import { resumeBroadcast } from "./util/resume-broadcast";
import { callbackQueryHandler } from "./handlers/callback-query";
import { handleBannedUsers } from "./handlers/handle-banned-users";
import { onBotAddedInChat } from "./handlers/on-bot-added-in-chat";
import { topicEditedHandler } from "./handlers/topic-edited-handler";
import { trackMessagesHandler } from "./handlers/track-messages-handler";
import { userAndChatSyncHandler } from "./handlers/user-and-chat-sync-handler";
import {
  dailyWordleCron,
  ensureDailyWordExists,
} from "./services/daily-wordle-cron";

bot.api.config.use(autoRetry());

// Log incoming updates
bot.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.info({
    update_id: ctx.update.update_id,
    user: ctx.from?.id,
    chat: ctx.chat?.id,
    duration: `${ms}ms`,
  }, "Update processed");
});

bot.use(userAndChatSyncHandler);
bot.use(topicEditedHandler);
bot.use(trackMessagesHandler);

bot.use(
  sequentialize((ctx) => {
    if (ctx.callbackQuery) return undefined;
    if (ctx.chat?.type === "private") return undefined;

    return ctx.chatId?.toString() || ctx.from?.id.toString();
  }),
);

bot.use(handleBannedUsers);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHander);
bot.use(onBotAddedInChat);

bot.catch(errorHandler);
dailyWordleCron.start();
await ensureDailyWordExists();

await bot.api.deleteWebhook({ drop_pending_updates: true });

// Resume any pending broadcast before starting the bot

run(bot);
logger.info("Bot started");

// Health check for or other cloud providers
if (env.WEB_SERVICE) {
  Bun.serve({
    port: process.env.PORT || 3000,
    fetch() {
      return new Response("Bot is running!");
    },
  });
}

await CommandsHelper.setCommands();
await resumeBroadcast();
