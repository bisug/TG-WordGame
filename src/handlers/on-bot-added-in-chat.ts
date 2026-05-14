import { Composer } from "grammy";

import { db } from "../config/db";
import { logger } from "../config/logger";
import { invalidateTopicsCache } from "../util/topic-cache";
import { getGeneralKeyboard } from "../util/get-general-keyboard";

const composer = new Composer();

composer.on("my_chat_member", async (ctx) => {
  const { old_chat_member, new_chat_member, chat } = ctx.myChatMember;

  if (chat.type === "channel") return;

  if (
    old_chat_member.status === "left" &&
    new_chat_member.status === "member"
  ) {
    if (chat.type === "group" || chat.type === "supergroup") {
      return ctx.reply(
        `<b>Thanks for adding WordSeek!</b>

<blockquote>To function correctly in your group, I need permission to read messages.
Please make me an <b>administrator</b> with only the required permissions listed below.</blockquote>

<b>Required permissions:</b>
• Read all messages
• View message history

That's all I need:  no other permissions are necessary.`,
        {
          parse_mode: "HTML",
          reply_markup: getGeneralKeyboard(),
        },
      );
    }
  }

  if (
    new_chat_member.status === "left" ||
    new_chat_member.status === "kicked"
  ) {
    const chatIdStr = chat.id.toString();

    await db.deleteFrom("broadcastChats").where("id", "=", chatIdStr).execute();

    // Cascading cleanup of stale data
    await db
      .deleteFrom("chatGameTopics")
      .where("chatId", "=", chatIdStr)
      .execute();

    await db.deleteFrom("games").where("activeChat", "=", chatIdStr).execute();

    await db
      .deleteFrom("authorizedUsers")
      .where("chatId", "=", chatIdStr)
      .execute();

    await invalidateTopicsCache(chatIdStr);

    logger.info(
      { chat_id: chat.id },
      "Bot was removed/blocked from chat. Cleaned up stale data.",
    );
  }
});

export const onBotAddedInChat = composer;
