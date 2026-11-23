import { autoRetry } from "@grammyjs/auto-retry";
import { run, sequentialize } from "@grammyjs/runner";
import { commands } from "./commands";
import { resumeBroadcast } from "./commands/broadcast";
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
import { getUpdateConstraint } from "./util/update-constraint";

// Bound retries: the defaults are infinite, so a Telegram outage can pin every
// runner slot and wedge shutdown until the force-exit watchdog fires.
bot.api.config.use(autoRetry({ maxRetryAttempts: 3, maxDelaySeconds: 10 }));

// The runner's stop() does not drain its sink. Track middleware so shutdown
// can wait for in-flight handlers before closing Redis and the DB pool.
let activeUpdates = 0;
let updatesDrained: (() => void) | null = null;

bot.use(async (_ctx, next) => {
  activeUpdates++;
  try {
    await next();
  } finally {
    activeUpdates--;
    if (activeUpdates === 0 && updatesDrained) {
      const resolve = updatesDrained;
      updatesDrained = null;
      resolve();
    }
  }
});

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

// Install the lock before middleware that touches shared DB/Redis state.
bot.use(sequentialize(getUpdateConstraint));

bot.use(userAndChatSyncHandler);
bot.use(topicEditedHandler);
bot.use(trackMessagesHandler);

// Anti-cheat rate limiting is applied per-handler where it makes sense:
// guesses (on-message), score/leaderboard, stats, ban/unban, captcha.

bot.use(handleBannedUsers);

bot.use(commands);
bot.use(callbackQueryHandler);
bot.use(onMessageHandler);
bot.use(onBotAddedInChat);

bot.catch(async (err) => {
  metrics.incErrors();
  // The error handler talks to DB/Redis (topic recreation). Awaiting it lets
  // this catch contain its rejection instead of leaking it to the runner.
  try {
    await errorHandler(err);
  } catch (handlerErr) {
    logger.error({ err: handlerErr }, "Error handler itself failed");
  }
});
dailyWordleCron.start();

try {
  await ensureDailyWordExists();
} catch (err) {
  logger.error({ err }, "Failed to ensure daily word exists");
}

try {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
} catch (err) {
  logger.error({ err }, "Failed to delete webhook");
}

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
    port: env.PORT,
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

try {
  await CommandsHelper.setCommands();
} catch (err) {
  logger.error({ err }, "Failed to register bot commands");
}

try {
  await resumeBroadcast();
} catch (err) {
  logger.error({ err }, "Failed to resume broadcast");
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");

  // Bounded force-exit watchdog: never hang forever if a close stalls.
  const forceExit = setTimeout(() => {
    logger.warn("Shutdown timed out after 10s, forcing exit");
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
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

    // runner.stop() stops fetching but does not wait for its sink to drain.
    await new Promise<void>((resolve) => {
      if (activeUpdates === 0) return resolve();
      updatesDrained = resolve;
    });
    dailyWordleCron.stop();
    try {
      await bot.stop();
    } catch (err) {
      logger.error({ err }, "Error stopping bot");
    }

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
  } finally {
    clearTimeout(forceExit);
    process.exit(0);
  }
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

// Last-resort safety nets. An unhandled rejection is logged but tolerated (a
// single missed catch shouldn't restart the whole bot); an uncaught exception
// means unknown process state, so log and exit — the deploy platform restarts.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception, exiting");
  process.exit(1);
});
