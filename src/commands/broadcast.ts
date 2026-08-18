import { Composer, GrammyError } from "grammy";

import { z } from "zod";
import { bot } from "../config/bot";
import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { formatDuration } from "../util/format-duration";

const composer = new Composer();

// Permanent failures mean the chat can never receive broadcasts again, so it
// is safe to delete it from broadcastChats. Transient failures (network
// errors, flood waits, Telegram 5xx) must NOT delete the chat — a flaky hour
// during a broadcast would otherwise shrink the audience forever.
function isPermanentBroadcastFailure(error: unknown): boolean {
  if (error instanceof GrammyError) {
    // 429 = flood wait, 5xx = Telegram server issue: both transient.
    if (error.error_code === 429 || error.error_code >= 500) return false;

    const desc = error.description.toLowerCase();
    const permanentPatterns = [
      "blocked",
      "kicked",
      "deactivated",
      "chat not found",
      "peer_id_invalid",
      "not enough rights",
      "have no rights",
      "chat_write_forbidden",
      "can't access the chat",
      "chat_admin_required",
    ];
    return permanentPatterns.some((p) => desc.includes(p));
  }
  // HttpError = network failure: transient. Unknown errors: treat as transient
  // to avoid permanently deleting chats on an unrecognized error.
  return false;
}

const broadcastStateSchema = z.object({
  messageId: z.number(),
  chatId: z.number(),
  totalChats: z.number(),
  currentIndex: z.number(),
  successCount: z.number(),
  blockedCount: z.number(),
  deletedCount: z.number(),
  unknownErrorCount: z.number(),
  startTime: z.number(),
  statusMessageId: z.number(),
  statusChatId: z.number(),
});

type BroadcastState = z.infer<typeof broadcastStateSchema>;

const BROADCAST_KEY = "broadcast:state";
const BROADCAST_LOCK_KEY = "broadcast:lock";
const BROADCAST_PROCESSED_KEY = "broadcast:processed";
// Chats that already counted as a transient failure in this run, so a resumed
// run retrying the same chat doesn't inflate unknownErrorCount.
const BROADCAST_FAILED_KEY = "broadcast:failed";

async function saveBroadcastState(state: BroadcastState) {
  await redis.set(BROADCAST_KEY, JSON.stringify(state), "EX", 86400);
}

async function getBroadcastState() {
  const data = await redis.get(BROADCAST_KEY);
  if (!data) return null;

  try {
    return broadcastStateSchema.parse(JSON.parse(data));
  } catch (error) {
    logger.error({ err: error }, "Invalid broadcast state in Redis");
    return null;
  }
}

async function clearBroadcastState() {
  await redis.del(BROADCAST_KEY);
  await redis.del(BROADCAST_LOCK_KEY);
  await redis.del(BROADCAST_PROCESSED_KEY);
  await redis.del(BROADCAST_FAILED_KEY);
}

export async function acquireBroadcastLock() {
  const result = await redis.set(BROADCAST_LOCK_KEY, "1", "EX", 3600, "NX");
  return result === "OK";
}

async function performBroadcast(
  chats: { id: string }[],
  state: BroadcastState,
) {
  // Iterate from the start every time (live run or resumed run) and skip chats
  // already recorded in processedChatIds. This keeps progress correct across a
  // restart even when blocked chats were removed from the DB mid-broadcast.
  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    if (!chat) continue;

    // Skip chats already delivered in this (or a resumed) run. Membership lives
    // in a redis SET so the JSON state stays constant-size instead of O(n^2)
    // re-serializing a growing array on every chat.
    if (await redis.sismember(BROADCAST_PROCESSED_KEY, chat.id)) {
      state.currentIndex = i + 1;
      continue;
    }

    // Cancellation is signalled by deleting the broadcast state key. A plain
    // EXISTS avoids re-parsing the full state on every chat.
    if (!(await redis.exists(BROADCAST_KEY))) return;

    try {
      await bot.api.copyMessage(Number(chat.id), state.chatId, state.messageId);
      state.successCount++;
    } catch (error) {
      if (isPermanentBroadcastFailure(error)) {
        state.blockedCount++;

        try {
          await db
            .deleteFrom("broadcastChats")
            .where("id", "=", chat.id)
            .execute();
          state.deletedCount++;
        } catch (deleteError) {
          logger.error(
            { err: deleteError, chatId: chat.id },
            "Failed to delete chat from broadcastChats",
          );
        }
      } else {
        // Transient failure (network, flood wait, Telegram 5xx). Keep the chat
        // in the DB and out of the processed set so a resumed run retries it.
        // SADD dedupes: a resumed run retrying this chat must not count it
        // twice.
        const firstFailure = await redis.sadd(BROADCAST_FAILED_KEY, chat.id);
        if (firstFailure) state.unknownErrorCount++;
        logger.warn(
          { err: error, chatId: chat.id },
          "Transient broadcast error, chat kept for retry",
        );
        state.currentIndex = i + 1;
        await saveBroadcastState(state);
        continue;
      }
    }

    await redis.sadd(BROADCAST_PROCESSED_KEY, chat.id);
    state.currentIndex = i + 1;
    await saveBroadcastState(state);

    if ((i + 1) % 50 === 0) {
      const elapsed = Date.now() - state.startTime;
      const estimatedTotal = (elapsed / (i + 1)) * chats.length;
      const estimatedRemaining = estimatedTotal - elapsed;

      try {
        await bot.api.editMessageText(
          state.statusChatId,
          state.statusMessageId,
          `<blockquote>Broadcast in progress!</blockquote>

Estimated time: <code>${formatDuration(estimatedRemaining)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>`,
          { parse_mode: "HTML" },
        );
      } catch (editError) {
        logger.debug(
          { err: editError },
          "Failed to update broadcast progress message (non-critical)",
        );
      }

      // Refresh the lock: a large audience outlives the 1h TTL, and an
      // expired lock lets another instance resume concurrently, double-sending.
      await redis.set(BROADCAST_LOCK_KEY, "1", "EX", 3600);

      await sleep(10_000);
    }
  }

  const totalTime = Date.now() - state.startTime;
  const totalFailed = state.blockedCount + state.unknownErrorCount;

  try {
    await bot.api.editMessageText(
      state.statusChatId,
      state.statusMessageId,
      `<blockquote>Broadcast completed!</blockquote>

Completed in: <code>${formatDuration(totalTime)}</code>
Total Users: <code>${chats.length}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>
Total Failed: <code>${totalFailed}</code>`,
      { parse_mode: "HTML" },
    );
  } catch (editError) {
    logger.debug(
      { err: editError },
      "Failed to update broadcast completion message (non-critical)",
    );
  }

  await clearBroadcastState();
}

composer.command("broadcast", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const { message } = ctx.update;
  const messageToForward = message?.reply_to_message?.message_id;

  if (!messageToForward || !message) {
    return ctx.reply(
      `<blockquote>No message to broadcast!</blockquote>

Please mention the message that you want to broadcast.`,
      { parse_mode: "HTML" },
    );
  }

  const existingState = await getBroadcastState();
  if (existingState) {
    return ctx.reply(
      `<blockquote>A broadcast is already in progress!</blockquote>

Progress: ${existingState.currentIndex}/${existingState.totalChats}
Use /broadcast_status to check status or /broadcast_cancel to cancel.`,
      { parse_mode: "HTML" },
    );
  }

  const lockAcquired = await acquireBroadcastLock();
  if (!lockAcquired) {
    return ctx.reply(
      `<blockquote>Failed to start broadcast. Please try again.</blockquote>`,
      { parse_mode: "HTML" },
    );
  }

  const chats = await db
    .selectFrom("broadcastChats")
    .selectAll()
    .orderBy("broadcastChats.createdAt", "asc")
    .execute();

  if (chats.length === 0) {
    await clearBroadcastState();
    return ctx.reply(
      `Not enough users are recorded yet!

<blockquote>Please try again later</blockquote>`,
      { parse_mode: "HTML" },
    );
  }

  const broadcastingMessage = await ctx.reply(
    `<blockquote>Broadcasting your message to ${chats.length} members</blockquote>`,
    { parse_mode: "HTML" },
  );

  const initialState: BroadcastState = {
    messageId: messageToForward,
    chatId: message.chat.id,
    totalChats: chats.length,
    currentIndex: 0,
    successCount: 0,
    blockedCount: 0,
    deletedCount: 0,
    unknownErrorCount: 0,
    startTime: Date.now(),
    statusMessageId: broadcastingMessage.message_id,
    statusChatId: broadcastingMessage.chat.id,
  };

  await saveBroadcastState(initialState);
  // Start fresh: clear any processed set left by a previous crashed run so we
  // don't skip chats. Resumed runs (resumeBroadcast) intentionally keep it.
  await redis.del(BROADCAST_PROCESSED_KEY);
  await performBroadcast(chats, initialState);
});

composer.command("broadcast_status", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const state = await getBroadcastState();
  if (!state) {
    return ctx.reply(`<blockquote>No broadcast in progress</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  const elapsed = Date.now() - state.startTime;
  const estimatedTotal =
    state.currentIndex === 0
      ? state.totalChats * 200
      : (elapsed / state.currentIndex) * state.totalChats;
  const estimatedRemaining = estimatedTotal - elapsed;

  await ctx.reply(
    `<blockquote>Broadcast in progress!</blockquote>

Progress: <code>${state.currentIndex}/${state.totalChats}</code>
Estimated time: <code>${formatDuration(estimatedRemaining)}</code>
Success: <code>${state.successCount}</code>
Blocked: <code>${state.blockedCount}</code>
Deleted: <code>${state.deletedCount}</code>`,
    { parse_mode: "HTML" },
  );
});

composer.command("broadcast_cancel", async (ctx) => {
  if (!ctx.from || ctx.chat.type !== "private") return;
  if (!env.ADMIN_USERS.includes(ctx.from.id)) return;

  const state = await getBroadcastState();
  if (!state) {
    return ctx.reply(`<blockquote>No broadcast in progress</blockquote>`, {
      parse_mode: "HTML",
    });
  }

  await clearBroadcastState();
  await ctx.reply(
    `<blockquote>Broadcast cancelled!</blockquote>

Completed: <code>${state.currentIndex}/${state.totalChats}</code>`,
    { parse_mode: "HTML" },
  );
});

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const broadcastCommand = composer;
export { getBroadcastState, performBroadcast };
