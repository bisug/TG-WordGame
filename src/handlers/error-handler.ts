import { BotError, Context, GrammyError, HttpError } from "grammy";

import { db } from "../config/db";
import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { getEndVoteKey } from "../util/end-vote";
import { deleteCachedGame } from "../util/game-cache";

export async function errorHandler(error: BotError<Context>) {
  const ctx = error.ctx;
  logger.error(
    { update_id: ctx.update.update_id },
    `Error while handling update:`,
  );
  const e = error.error;

  if (e instanceof GrammyError) {
    logger.error({ description: e.description }, "Error in request:");

    // Specific case: bot doesn't have permission to send messages
    conditions: if (
      e.description.includes(
        "not enough rights to send text messages to the chat",
      ) &&
      ctx.chat?.type !== "private"
    ) {
      try {
        if (ctx.chat) {
          logger.info(
            { chat_id: ctx.chat.id },
            `Leaving chat due to missing rights.`,
          );
          await ctx.api.leaveChat(ctx.chat.id);
        }
      } catch (leaveErr) {
        logger.error({ err: leaveErr }, "Failed to leave chat");
      }
    } else if (
      e.description.includes("message thread not found") &&
      ctx.chatId &&
      ctx.msg
    ) {
      const topicsData = await db
        .selectFrom("chatGameTopics")
        .selectAll()
        .where("chatId", "=", ctx.chatId.toString())
        .execute();
      const currentTopicId = ctx.msg.message_thread_id?.toString();
      if (!currentTopicId) break conditions;

      const topic = topicsData.find((t) => t.topicId === currentTopicId);
      if (!topic || !topic.shouldRecreateOnExpire) break conditions;

      const message = await ctx.api.sendMessage(
        ctx.chatId,
        "Recreating topic...",
      );
      try {
        const createdTopic = await ctx.createForumTopic(
          topic.name || "WordSeek",
          {
            icon_custom_emoji_id: topic.iconCustomEmojiId ?? undefined,
          },
        );
        await ctx.deleteForumTopic();
        await ctx.api.deleteMessage(ctx.chatId, message.message_id);
        await db
          .insertInto("chatGameTopics")
          .values({
            chatId: ctx.chatId.toString(),
            topicId: createdTopic.message_thread_id.toString(),
            iconCustomEmojiId: createdTopic.icon_custom_emoji_id,
            shouldRecreateOnExpire: true,
            allowedLengths: topic.allowedLengths,
            name: topic.name,
          })
          .execute();
        await db
          .deleteFrom("chatGameTopics")
          .where("chatId", "=", ctx.chatId.toString())
          .where("topicId", "=", currentTopicId)
          .execute();
        // Clear the topic-scoped vote key (the bare `vote:${chatId}` key is
        // never written, so deleting it was a no-op) and any game tied to the
        // now-defunct topic so a stale "Vote to End" button can't end it.
        await redis.del(getEndVoteKey(ctx.chatId.toString(), currentTopicId));
        await db
          .deleteFrom("games")
          .where("activeChat", "=", ctx.chatId.toString())
          .where("topicId", "=", currentTopicId)
          .execute();
        await deleteCachedGame(ctx.chatId.toString(), currentTopicId);

        await ctx.api.sendMessage(
          ctx.chatId,
          "Topic recreated successfully. You can now continue start playing in this topic.",
          {
            reply_parameters: { message_id: createdTopic.message_thread_id },
          },
        );
      } catch {
        await ctx.api.editMessageText(
          ctx.chatId,
          message.message_id,
          "I don't have enough rights to create and delete topics. Please update my permissions.",
        );
      }
    }
  } else if (e instanceof HttpError) {
    logger.error({ err: e }, "Could not contact Telegram");
  } else {
    logger.error({ err: e }, "Unknown error");
  }
}
