import { Composer } from "grammy";

import { logger } from "../config/logger";
import { ensureChat, ensureUser } from "../util/sync-entities";

const composer = new Composer();

composer.use(async (ctx, next) => {
  try {
    await ensureUser(ctx.from);
    await ensureChat(ctx.chat, ctx.from);
  } catch (error) {
    logger.error({ err: error }, "Error in sync middleware");
  }

  return next();
});

export const userAndChatSyncHandler = composer;
