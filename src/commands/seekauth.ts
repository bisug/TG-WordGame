import { Composer, type Context } from "grammy";

import { sql } from "kysely";

import { db } from "../config/db";
import { env } from "../config/env";
import { CommandsHelper } from "../util/commands-helper";
import { escapeHtmlEntities } from "../util/escape-html-entities";
import { ensureUser } from "../util/sync-entities";

const composer = new Composer();

function formatUserLabel(user: { name: string; username?: string | null }) {
  const name = escapeHtmlEntities(user.name);
  return user.username
    ? `@${escapeHtmlEntities(user.username)} (${name})`
    : name;
}

function formatLinkedUser(user: {
  id: string;
  name: string;
  username?: string | null;
}) {
  const username = user.username
    ? ` (@${escapeHtmlEntities(user.username)})`
    : "";
  return `<a href="tg://user?id=${user.id}">${escapeHtmlEntities(
    user.name,
  )}</a>${username}`;
}

export async function getTargetUser(
  ctx: Context,
  identifier: string | undefined,
  fallback = false,
) {
  if (
    fallback &&
    !identifier &&
    ctx.from &&
    ctx.chatId?.toString() === ctx.from.id.toString()
  ) {
    return ensureUser(ctx.from);
  }

  const replyToMessage = ctx.message?.reply_to_message;
  const replyToMessageFrom = replyToMessage?.from;

  if (
    replyToMessageFrom &&
    !replyToMessageFrom.is_bot &&
    !replyToMessage.is_topic_message
  ) {
    return ensureUser(replyToMessageFrom);
  }

  if (fallback && !identifier) {
    return ensureUser(ctx.from);
  }

  const entities = ctx.message?.entities || [];
  const cmdEntity = entities.find((e) => e.type === "bot_command");
  const argStart = (cmdEntity?.length || 0) + 1;

  for (const entity of entities) {
    if (entity.offset < argStart) continue;

    if (entity.type === "text_mention") {
      return ensureUser(entity.user);
    }

    if (identifier && entity.type === "mention") {
      const username = identifier.slice(1);

      const user = await db
        .selectFrom("users")
        .select(["id", "name", "username"])
        .where(sql`lower(username)`, "=", username.toLowerCase())
        .executeTakeFirst();

      return user || null;
    }
  }

  if (identifier && /^\d+$/.test(identifier)) {
    try {
      const member = await ctx.getChatMember(parseInt(identifier, 10));
      if (member.user) {
        return ensureUser(member.user);
      }
    } catch {
      // Fall through to database
    }

    const user = await db
      .selectFrom("users")
      .select(["id", "name", "username"])
      .where("id", "=", identifier)
      .executeTakeFirst();

    return user || null;
  }

  return null;
}

composer.command("seekauth", async (ctx) => {
  if (!ctx.chat || !ctx.from) return;

  const chatId = ctx.chat.id.toString();
  const userId = ctx.from.id;
  const chatMember = await ctx.getChatMember(userId);
  const isAdmin =
    chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(userId);

  const replyConfig = {
    reply_parameters: { message_id: ctx.msgId },
    parse_mode: "HTML" as const,
  };

  if (!isAdmin && !isSystemAdmin) {
    return await ctx.reply(
      "❌ You don't have permission to use this command. Only administrators can manage authorized users.",
      replyConfig,
    );
  }

  const args = ctx.match?.trim();

  const parts = args.split(" ");
  const action = parts[0]?.toLowerCase();

  if (action === "list") {
    const authorizedUsers = await db
      .selectFrom("authorizedUsers")
      .innerJoin("users", "users.id", "authorizedUsers.userId")
      .where("authorizedUsers.chatId", "=", chatId)
      .select(["users.id", "users.name", "users.username"])
      .execute();

    if (authorizedUsers.length === 0) {
      return await ctx.reply(
        "📋 No authorized users in this chat.",
        replyConfig,
      );
    }

    const userList = authorizedUsers
      .map((user) => `• ${formatLinkedUser(user)}`)
      .join("\n");

    return await ctx.reply(
      `<b>🔐 Authorized Users for Seek Game</b>\n\n${userList}`,
      replyConfig,
    );
  }

  if (action === "remove") {
    const targetUser = await getTargetUser(ctx, parts[1]);

    if (!targetUser) {
      return await ctx.reply("❌ User not found.", replyConfig);
    }

    const deleted = await db
      .deleteFrom("authorizedUsers")
      .where("chatId", "=", chatId)
      .where("userId", "=", targetUser.id)
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return await ctx.reply("❌ This user is not authorized.", replyConfig);
    }

    const userName = formatUserLabel(targetUser);

    return await ctx.reply(
      `✅ <b>${userName}</b> is no longer authorized to end the game.`,
      replyConfig,
    );
  }

  const targetUser = await getTargetUser(ctx, action);

  if (!targetUser) {
    return await ctx.reply(
      "❌ Could not identify the user. Please mention with @username, provide user ID, or reply to their message.",
      replyConfig,
    );
  }

  const existing = await db
    .selectFrom("authorizedUsers")
    .where("chatId", "=", chatId)
    .where("userId", "=", targetUser.id)
    .executeTakeFirst();

  if (existing) {
    return await ctx.reply(
      `⚠️ <b>${escapeHtmlEntities(
        targetUser.name,
      )}</b> is already authorized to end the game in this chat.`,
      replyConfig,
    );
  }

  await db
    .insertInto("authorizedUsers")
    .values({
      chatId,
      userId: targetUser.id,
      authorizedBy: userId.toString(),
    })
    .execute();

  const userName = formatUserLabel(targetUser);

  return await ctx.reply(
    `✅ <b>${userName}</b> is now authorized to end the game without voting!`,
    replyConfig,
  );
});

CommandsHelper.addNewCommand(
  "seekauth",
  "Manage users authorized to end the seek game (admin only)",
);

export const seekAuthCommand = composer;
