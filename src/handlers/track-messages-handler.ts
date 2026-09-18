import { Composer, type Context } from "grammy";

import { env } from "../config/env";
import { logger } from "../config/logger";
import { getTrackingAdminChatId } from "../util/tracking-cache";

const composer = new Composer();

// Ordered [pattern, reason] table: first match wins, so the chain of
// individual tests stays short and adding a pattern is a one-line change.
const SUSPICIOUS_PATTERNS: Array<[RegExp, string]> = [
  [/auto-player/i, "Auto-player keyword detected"],
  [/\/sws/i, "Contains /sws command"],
  [/\/ews/i, "Contains /ews command"],
  [/^\.xx\b/i, "Dot command detected (e.g., .xx)"],
  [/\/wordhck/i, "Contains /wordhck command"],
  [/\/stophck/i, "Contains /stophck command"],
  [/\/wordon/i, "Contains /wordon command"],
  [/\/wordoff/i, "Contains /wordoff command"],
  [/^\.benable\b/i, "Contains .benable command"],
  [/^\.word_seek\b/i, "Contains .word_seek command"],
  [/^\.stop_seek\b/i, "Contains .stop_seek command"],
];

const detectSuspiciousPattern = (
  text: string | undefined,
): string | undefined => {
  if (!text) return undefined;
  return SUSPICIOUS_PATTERNS.find(([re]) => re.test(text))?.[1];
};

const sendSuspiciousAlert = async (
  ctx: Context,
  adminChatId: number,
  reason: string,
  messageText?: string,
) => {
  const from = ctx.from || ctx.message?.from || ctx.editedMessage?.from;
  const chat = ctx.chat;

  if (!from || !chat) return;

  const userName =
    from.first_name + (from.last_name ? ` ${from.last_name}` : "");
  const username = from.username ? `@${from.username}` : "No username";
  const userId = from.id;
  const chatId = chat.id;
  const chatTitle = chat.title || chat.first_name || "Unknown";

  let alertMessage = `🚨 SUSPICIOUS ACTIVITY DETECTED\n\n`;
  alertMessage += `Reason: ${reason}\n\n`;
  alertMessage += `👤 User Info:\n`;
  alertMessage += `├ Name: ${userName}\n`;
  alertMessage += `├ Username: ${username}\n`;
  alertMessage += `└ User ID: ${userId}\n\n`;
  alertMessage += `💬 Chat Info:\n`;
  alertMessage += `├ Title: ${chatTitle}\n`;
  alertMessage += `└ Chat ID: ${chatId}\n`;

  if (messageText) {
    alertMessage += `\n📝 Message:\n${messageText.substring(0, 500)}${messageText.length > 500 ? "..." : ""}`;
  }

  await ctx.api.sendMessage(adminChatId, alertMessage);
};

composer.use(async (ctx, next) => {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await next();
    return;
  }

  // --- Synchronous suspicious-pattern detection (no I/O) ---
  let isSuspicious = false;
  let suspiciousReason = "";
  let messageText = "";

  if (ctx.message?.text || ctx.message?.caption) {
    messageText = ctx.message.text || ctx.message.caption || "";

    const reason = detectSuspiciousPattern(messageText);
    if (reason) {
      isSuspicious = true;
      suspiciousReason = reason;
    }
  }

  if (ctx.editedMessage?.text || ctx.editedMessage?.caption) {
    messageText = ctx.editedMessage.text || ctx.editedMessage.caption || "";

    const reason = detectSuspiciousPattern(messageText);
    if (reason) {
      isSuspicious = true;
      suspiciousReason = `Edited message: ${reason.toLowerCase()}`;
    }
  }

  // Alerting is best-effort and already self-contained; fire it off without
  // making the user's own command wait on a Telegram send.
  if (isSuspicious) {
    void (async () => {
      if (env.LOGS_CHANNEL) {
        try {
          await sendSuspiciousAlert(
            ctx,
            env.LOGS_CHANNEL,
            suspiciousReason,
            messageText,
          );

          if (ctx.message?.message_id) {
            try {
              await ctx.api.forwardMessage(
                env.LOGS_CHANNEL,
                chatId,
                ctx.message.message_id,
              );
            } catch (e) {
              logger.error(
                { err: e },
                "Failed to forward message to logs channel",
              );
            }
          }
        } catch (error) {
          logger.error({ err: error }, "Failed to send alert to logs channel");
        }
      } else {
        for (const adminId of env.ADMIN_USERS) {
          try {
            await sendSuspiciousAlert(
              ctx,
              adminId,
              suspiciousReason,
              messageText,
            );

            if (ctx.message?.message_id) {
              try {
                await ctx.api.forwardMessage(
                  adminId,
                  chatId,
                  ctx.message.message_id,
                );
              } catch (e) {
                logger.error(
                  { err: e, adminId, chatId },
                  "Failed to forward suspicious message to admin",
                );
              }
            }
          } catch (error) {
            logger.error({ err: error, adminId }, "Failed to alert admin");
          }
        }
      }
    })();
  }

  // Single cheap redis GET — keep it before next() so we don't race the reply.
  const adminChatId = await getTrackingAdminChatId(chatId);

  // Respond to the user immediately; tracking forwards happen afterwards.
  await next();

  if (adminChatId) {
    void (async () => {
      try {
        if (ctx.message) {
          const msg = ctx.message;

          if (
            msg.text ||
            msg.photo ||
            msg.video ||
            msg.document ||
            msg.audio ||
            msg.voice ||
            msg.sticker ||
            msg.animation ||
            msg.video_note ||
            msg.poll ||
            msg.location ||
            msg.venue ||
            msg.contact
          ) {
            try {
              await ctx.api.forwardMessage(
                Number(adminChatId),
                chatId,
                msg.message_id,
              );
            } catch (_error) {
              const from = msg.from
                ? `${msg.from.first_name}${msg.from.username ? ` (@${msg.from.username})` : ""}`
                : "Unknown";
              let messageType = "message";

              if (msg.photo) messageType = "📷 Photo";
              else if (msg.video) messageType = "🎥 Video";
              else if (msg.document) messageType = "📄 Document";
              else if (msg.audio) messageType = "🎵 Audio";
              else if (msg.voice) messageType = "🎤 Voice";
              else if (msg.sticker) messageType = "🎭 Sticker";
              else if (msg.animation) messageType = "🎬 GIF";
              else if (msg.video_note) messageType = "📹 Video Note";
              else if (msg.poll) messageType = "📊 Poll";
              else if (msg.location) messageType = "📍 Location";
              else if (msg.venue) messageType = "🏢 Venue";
              else if (msg.contact) messageType = "👤 Contact";

              await ctx.api.sendMessage(
                Number(adminChatId),
                `🔔 New ${messageType} in chat ${chatId}\nFrom: ${from}\n\nMessage ID: ${msg.message_id}${msg.text ? `\n\n${msg.text}` : ""}`,
              );
            }
          }
        } else if (ctx.channelPost) {
          const post = ctx.channelPost;
          try {
            await ctx.api.forwardMessage(
              Number(adminChatId),
              chatId,
              post.message_id,
            );
          } catch (_error) {
            await ctx.api.sendMessage(
              Number(adminChatId),
              `🔔 New channel post in chat ${chatId}\nPost ID: ${post.message_id}`,
            );
          }
        } else if (ctx.editedMessage) {
          const edited = ctx.editedMessage;
          const from = edited.from
            ? `${edited.from.first_name}${edited.from.username ? ` (@${edited.from.username})` : ""}`
            : "Unknown";
          const text = edited.text || edited.caption || "[Media message]";

          await ctx.api.sendMessage(
            Number(adminChatId),
            `✏️ Message edited in chat ${chatId}\nFrom: ${from}\nNew text: ${text.substring(0, 200)}${text.length > 200 ? "..." : ""}`,
          );
        } else if (ctx.chatMember) {
          const update = ctx.chatMember;
          const user = update.new_chat_member.user;
          const oldStatus = update.old_chat_member.status;
          const newStatus = update.new_chat_member.status;

          await ctx.api.sendMessage(
            Number(adminChatId),
            `👥 Member status change in chat ${chatId}\nUser: ${user.first_name}${user.username ? ` (@${user.username})` : ""}\n${oldStatus} → ${newStatus}`,
          );
        } else if (ctx.myChatMember) {
          const update = ctx.myChatMember;
          const oldStatus = update.old_chat_member.status;
          const newStatus = update.new_chat_member.status;

          await ctx.api.sendMessage(
            Number(adminChatId),
            `🤖 Bot status change in chat ${chatId}\n${oldStatus} → ${newStatus}`,
          );
        } else if (ctx.callbackQuery) {
          const query = ctx.callbackQuery;
          const from = query.from;
          const data = query.data || "No data";

          await ctx.api.sendMessage(
            Number(adminChatId),
            `🔘 Button clicked in chat ${chatId}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nData: ${data}`,
          );
        } else if (ctx.inlineQuery) {
          const query = ctx.inlineQuery;
          const from = query.from;

          await ctx.api.sendMessage(
            Number(adminChatId),
            `🔍 Inline query in chat ${chatId}\nFrom: ${from.first_name}${from.username ? ` (@${from.username})` : ""}\nQuery: ${query.query}`,
          );
        }
      } catch (error) {
        logger.error({ err: error }, "Tracking error");
      }
    })();
  }
});

export const trackMessagesHandler = composer;
