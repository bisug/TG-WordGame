import { Composer } from "grammy";

import { logger } from "../config/logger";
import { ensureChat, ensureUser } from "../util/sync-entities";

const composer = new Composer();

// Sync is best-effort eventual consistency: sync-entities is idempotent
// (INSERT ... ON CONFLICT DO UPDATE) and backed by in-process + redis caches,
// so dropping the work on the floor is safe and simply retries on the next
// update. We never await it — blocking the user's real handler on a DB upsert
// for every single message is the single biggest per-update latency cost.
composer.use((ctx, next) => {
  const needsSync =
    ctx.message || ctx.editedMessage || ctx.chatMember || ctx.myChatMember;
  if (needsSync && ctx.from && !ctx.from.is_bot) {
    void ensureUser(ctx.from).catch((e) =>
      logger.error({ err: e }, "user sync failed"),
    );
    void ensureChat(ctx.chat, ctx.from).catch((e) =>
      logger.error({ err: e }, "chat sync failed"),
    );
  }
  return next();
});

export const userAndChatSyncHandler = composer;
