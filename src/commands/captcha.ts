import { Composer, InlineKeyboard } from "grammy";
import { SLOT_SYMBOLS } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { captchaQueue } from "../queues/captcha-queue";
import { captchaSchema } from "../schemas";
import { safeJsonParse } from "../util/safe-json-parse";
import { CAPTCHA_ACTIONS } from "../util/button-actions";
import { shouldChallengeUser } from "../handlers/anticheat";

const composer = new Composer();

export const decodeSlot = (value: number): string[] => {
  const n = value - 1;
  const symbolAt = (index: number) => SLOT_SYMBOLS[index] ?? SLOT_SYMBOLS[0];

  return [symbolAt(n & 3), symbolAt((n >> 2) & 3), symbolAt((n >> 4) & 3)];
};

export const buildCaptchaKeyboard = (progress: string[]) => {
  const keyboard = new InlineKeyboard();

  // Show all symbol options
  SLOT_SYMBOLS.forEach((e) => {
    keyboard.text(e, `${CAPTCHA_ACTIONS.PICK_PREFIX} ${e}`);
  });

  if (progress.length > 0) {
    keyboard.row().text("⬅️ Undo", CAPTCHA_ACTIONS.BACK).text("❌ Start Over", CAPTCHA_ACTIONS.CLEAR);
  }

  return keyboard;
};

export const buildMessage = ({
  mention,
  progress,
  attempts,
  maxAttempts,
  status,
}: {
  mention?: string;
  progress: string[];
  attempts: number;
  maxAttempts: number;
  status?: string;
}) => {
  const filled = [...progress];
  while (filled.length < 3) filled.push("⬜");

  let message = "";

  message += `🎰 <b>Quick Verification</b>\n\n`;
  
  message += `${mention ? `${mention}, ` : ""}Please tap the 3 symbols shown in the dice roll above.\n\n`;
  message += `🎲 Your selection: ${filled.join(" ")}\n`;
  
  if (attempts > 0) {
    message += `📝 Attempts: ${attempts}/${maxAttempts}\n`;
  }
  
  message += `📌 ${status ?? "Tap the symbols in order, from left to right."}`;
  
  return message;
};

export const formatUserMention = ({
  id,
  name,
  username,
}: {
  id: string;
  name?: string | null;
  username?: string | null;
}) => {
  if (username) return `@${username}`;
  return `<a href="tg://user?id=${id}">${name || "User"}</a>`;
};

composer.command("captcha", async (ctx) => {
  if (!ctx.from || !env.ADMIN_USERS.includes(ctx.from.id)) {
    return;
  }

  if (ctx.chat?.type !== "private") {
    return;
  }

  if (!ctx.message) return;

  const parts = ctx.message.text.split(" ");
  const chatId = parts[1];
  const userId = parts[2];

  if (!chatId || !userId) {
    return ctx.reply(
      "📖 <b>Captcha Command Help</b>\n\n" +
      "Send a verification challenge to a user.\n\n" +
      "<b>Usage:</b>\n" +
      "/captcha <chatId> <userId>\n\n" +
      "<b>When to use:</b>\n" +
      "• User shows suspicious activity\n" +
      "• User was flagged by the system\n" +
      "• You suspect bot behavior\n\n" +
      "<b>Note:</b> Users are only challenged automatically if they show suspicious patterns. This command is for manual review cases.",
      { parse_mode: "HTML" }
    );
  }

  // Check if user should be challenged
  const challengeCheck = await shouldChallengeUser(userId);
  if (!challengeCheck.challenge) {
    return ctx.reply(
      `✅ This user doesn't need verification.\n\n` +
      `They haven't shown any suspicious activity.\n\n` +
      `Use this command only for users with flags.`,
    );
  }

  const key = `captcha:${chatId}:${userId}`;
  const existing = await redis.get(key);

  if (existing) {
    const session = safeJsonParse<{ attempts?: number }>(existing, {});

    return ctx.reply(
      `⚠️ A verification is already active for this user.\n\n` +
        `Attempts: ${session.attempts ?? 0}/3\n` +
        `Status: Pending`,
    );
  }

  const user = await db
    .selectFrom("users")
    .select(["id", "name", "username"])
    .where("id", "=", userId)
    .executeTakeFirst();

  const mention = formatUserMention({
    id: userId,
    name: user?.name,
    username: user?.username,
  });

  const diceMsg = await ctx.api.sendDice(chatId, "🎰");
  const value = diceMsg.dice?.value;

  const answer = decodeSlot(value);

  const keyboard = buildCaptchaKeyboard([]);

  const msg = await ctx.api.sendMessage(
    chatId,
    buildMessage({
      mention,
      progress: [],
      attempts: 0,
      maxAttempts: 3,
    }),
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
      reply_parameters: { message_id: diceMsg.message_id },
    },
  );

  const session = captchaSchema.parse({
    chatId,
    userId,
    adminId: ctx.from.id.toString(),
    messageId: msg.message_id,
    answer,
    progress: [],
    attempts: 0,
    createdAt: Date.now(),
    name: user?.name,
    username: user?.username,
  });

  await redis.set(key, JSON.stringify(session), "EX", 80); // 80 second to make sure bullmq fires

  await captchaQueue.add(
    "expire",
    { chatId, userId, messageId: msg.message_id },
    { delay: 60_000, removeOnComplete: true },
  );

  const mentionText = user
    ? formatUserMention({
        id: userId,
        name: user.name,
        username: user.username,
      })
    : `<a href="tg://user?id=${userId}">User</a>`;

  await ctx.reply(`✅ Captcha sent for ${mentionText}.`, {
    parse_mode: "HTML",
  });
});

export const captchaCommand = composer;
