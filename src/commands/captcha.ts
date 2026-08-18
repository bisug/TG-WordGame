import { Composer } from "grammy";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { rateLimit, shouldChallengeUser } from "../handlers/anticheat";
import { sendCaptchaChallenge } from "../util/captcha-challenge";
import { safeJsonParse } from "../util/safe-json-parse";

const composer = new Composer();

composer.command("captcha", rateLimit("captcha"), async (ctx) => {
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
      { parse_mode: "HTML" },
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

  const result = await sendCaptchaChallenge(
    chatId,
    userId,
    ctx.from.id.toString(),
  );

  if (!result.ok) {
    return ctx.reply(
      "❌ Could not send the verification challenge. Please try again.",
    );
  }

  await ctx.reply(`✅ Captcha sent in chat <code>${chatId}</code>.`, {
    parse_mode: "HTML",
  });
});

export const captchaCommand = composer;
