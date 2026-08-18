import { Composer } from "grammy";

import { db } from "../config/db";
import { logger } from "../config/logger";
import { invalidateTopicsCache } from "../util/topic-cache";

const composer = new Composer();

composer.on("message:forum_topic_edited", async (ctx) => {
  if (!ctx.chatId || !ctx.msg.message_thread_id) return;

  const details = ctx.msg.forum_topic_edited;

  const updates: { name?: string; iconCustomEmojiId?: string } = {};

  if (details.name) {
    updates.name = details.name;
  }

  if (details.icon_custom_emoji_id) {
    updates.iconCustomEmojiId = details.icon_custom_emoji_id;
  }

  if (Object.keys(updates).length === 0) return;

  const chatIdForQuery = ctx.chatId.toString();
  const topicIdForQuery = ctx.msg.message_thread_id.toString();

  try {
    await db
      .updateTable("chatGameTopics")
      .set(updates)
      .where("chatGameTopics.chatId", "=", chatIdForQuery)
      .where("topicId", "=", topicIdForQuery)
      .execute();

    // Keep the 24h topics cache from serving the stale name/icon (used when
    // recreating expired topics).
    await invalidateTopicsCache(chatIdForQuery);
  } catch (err) {
    logger.error(
      { err, chatId: chatIdForQuery, topicId: topicIdForQuery, updates },
      "Failed updating chatGameTopics",
    );
  }
});

export const topicEditedHandler = composer;
