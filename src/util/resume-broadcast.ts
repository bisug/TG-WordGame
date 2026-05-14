import { getBroadcastState, performBroadcast } from "../commands/broadcast";
import { bot } from "../config/bot";
import { db } from "../config/db";
import { logger } from "../config/logger";

export async function resumeBroadcast() {
  const state = await getBroadcastState();
  if (!state) return;

  logger.info({ currentIndex: state.currentIndex, totalChats: state.totalChats }, "Resuming broadcast");

  const chats = await db
    .selectFrom("broadcastChats")
    .selectAll()
    .orderBy("broadcastChats.createdAt", "asc")
    .execute();

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
