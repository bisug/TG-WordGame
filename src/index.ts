import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";
import { commands } from "./commands";
import { bot } from "./config/bot";
import { db } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { metrics } from "./config/metrics";
import { redis } from "./config/redis";
import { callbackQueryHandler } from "./handlers/callback-query";
import { errorHandler } from "./handlers/error-handler";
import { handleBannedUsers } from "./handlers/handle-banned-users";
import { onBotAddedInChat } from "./handlers/on-bot-added-in-chat";
import { onMessageHandler } from "./handlers/on-message";
import { topicEditedHandler } from "./handlers/topic-edited-handler";
import { trackMessagesHandler } from "./handlers/track-messages-handler";
import { userAndChatSyncHandler } from "./handlers/user-and-chat-sync-handler";
import { captchaQueue, captchaWorker } from "./queues/captcha-queue";
import {
  dailyWordleCron,
  ensureDailyWordExists,
} from "./services/daily-wordle-cron";
import { CommandsHelper } from "./util/commands-helper";
import { resumeBroadcast } from "./util/resume-broadcast";

bot.api.config.use(autoRetry());

// Log incoming updates & record metrics
bot.use(async (ctx, next) => {
  const start = Date.now();
  metrics.incUpdates();
  await next();
  const ms = Date.now() - start;
  metrics.recordDuration(ms);
  logger.info(
    {
      update_id: ctx.update.update_id,
      user: ctx.from?.id,
      chat: ctx.chat?.id,
      duration: `${ms}ms`,
    },
    "Update processed",
  );
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

// Anti-cheat rate limiting is applied per-handler where it makes sense:
// guesses (on-message), score/leaderboard, stats, ban/unban, captcha.

bot.use(handleBannedUsers);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHandler);
bot.use(onBotAddedInChat);

bot.catch((err) => {
  metrics.incErrors();
  return errorHandler(err);
});
dailyWordleCron.start();
await ensureDailyWordExists();

await bot.api.deleteWebhook({ drop_pending_updates: true });

// Resume any pending broadcast before starting the bot

// Bounded concurrency: keeps steady-state in-flight DB connections well under
// the pool's max (src/config/db.ts). sequentialize() already throttles real
// concurrency to active chats, so 15 is ample; raise this together with the
// pool size if benchmarking shows saturation.
const runner = run(bot, { sink: { concurrency: 15 } });
logger.info("Bot started");

// Health check & metrics server for cloud containers
if (env.WEB_SERVICE) {
  Bun.serve({
    port: process.env.PORT || 3000,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/healthz") {
        try {
          await db.selectFrom("users").select("id").limit(1).execute();
          return new Response("OK", { status: 200 });
        } catch {
          return new Response("UNHEALTHY", { status: 500 });
        }
      }
      if (url.pathname === "/metrics") {
        return new Response(metrics.toPrometheusFormat(), {
          headers: { "Content-Type": "text/plain; version=0.0.4" },
        });
      }
      return new Response("Bot is running!");
    },
  });
}

await CommandsHelper.setCommands();
await resumeBroadcast();

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  try {
    await captchaWorker.close();
    await captchaQueue.close();
  } catch (err) {
    logger.error({ err }, "Error closing captcha queue");
  }
  try {
    await runner.stop();
  } catch (err) {
    logger.error({ err }, "Error stopping bot runner");
  }
  dailyWordleCron.stop();
  await bot.stop();

  // Release backend connections so restarts/deploys don't orphan sockets.
  try {
    await redis.quit();
  } catch (err) {
    logger.error({ err }, "Error closing redis");
  }
  try {
    await db.destroy();
  } catch (err) {
    logger.error({ err }, "Error closing db pool");
  }

  // Bounded force-exit: never hang forever if a close stalls.
  const forceExit = setTimeout(() => process.exit(1), 10000);
  forceExit.unref();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
