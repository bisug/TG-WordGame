import { InlineKeyboard } from "grammy";

import { bot } from "../config/bot";
import { SLOT_SYMBOLS } from "../config/constants";
import { db } from "../config/db";
import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { captchaQueue } from "../queues/captcha-queue";
import { captchaSchema } from "../schemas";
import { CAPTCHA_ACTIONS } from "./button-actions";
import { formatUserMention } from "./user-mention";

// Re-exported for existing importers (callback-query handler).
export { formatUserMention };

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
    keyboard
      .row()
      .text("⬅️ Undo", CAPTCHA_ACTIONS.BACK)
      .text("❌ Start Over", CAPTCHA_ACTIONS.CLEAR);
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


export type ChallengeResult =
  | { ok: true }
  | { ok: false; reason: "already_active" | "send_failed" };

/**
 * Send a slot-machine captcha challenge to `userId` in `chatId`.
 * Shared by the manual /captcha command and the automatic anti-cheat
 * challenge so both paths behave identically.
 */
export async function sendCaptchaChallenge(
  chatId: string,
  userId: string,
  adminId: string,
): Promise<ChallengeResult> {
  const key = `captcha:${chatId}:${userId}`;
  const existing = await redis.get(key);

  if (existing) {
    return { ok: false, reason: "already_active" };
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

  try {
    const diceMsg = await bot.api.sendDice(chatId, "🎰");
    const value = diceMsg.dice?.value;

    const answer = decodeSlot(value);

    const keyboard = buildCaptchaKeyboard([]);

    const msg = await bot.api.sendMessage(
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
      adminId,
      messageId: msg.message_id,
      answer,
      progress: [],
      attempts: 0,
      createdAt: Date.now(),
      name: user?.name,
      username: user?.username,
    });

    await redis.set(key, JSON.stringify(session), "EX", 80); // 80 seconds to make sure bullmq fires

    await captchaQueue.add(
      "expire",
      { chatId, userId, messageId: msg.message_id },
      { delay: 60_000, removeOnComplete: true },
    );

    return { ok: true };
  } catch (err) {
    logger.error({ err, chatId, userId }, "Failed to send captcha challenge");
    return { ok: false, reason: "send_failed" };
  }
}
