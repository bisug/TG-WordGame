import {
  acquireBroadcastLock,
  getBroadcastState,
  performBroadcast,
} from "../commands/broadcast";
import { bot } from "../config/bot";
import { db } from "../config/db";
import { logger } from "../config/logger";

export async function resumeBroadcast() {
  const state = await getBroadcastState();
  if (!state) return;

  // Another instance may already own the broadcast; only one should resume.
  if (!(await acquireBroadcastLock())) {
    logger.info("Another instance holds the broadcast lock; skipping resume");
    return;
  }

  logger.info(
    { currentIndex: state.currentIndex, totalChats: state.totalChats },
    "Resuming broadcast",
  );

  const chats = await db
    .selectFrom("broadcastChats")
    .selectAll()
    .orderBy("broadcastChats.createdAt", "asc")
    .execute();

  // The fresh list may be shorter than the original (blocked chats removed
  // during the previous run), so reflect the actual size for accurate progress.
  state.totalChats = chats.length;

  try {
    await bot.api.editMessageText(
      state.statusChatId,
      state.statusMessageId,
      `<blockquote>Broadcast resumed after restart!</blockquote>

Resuming from: <code>${state.currentIndex}/${state.totalChats}</code>
Total Users: <code>${state.totalChats}</code>
Success so far: <code>${state.successCount}</code>`,
      { parse_mode: "HTML" },
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to update status message");
  }

  await performBroadcast(chats, state);
  logger.info("Broadcast resumed and completed successfully");
}
