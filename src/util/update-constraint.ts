import type { Context } from "grammy";

// The runner processes updates concurrently. Every update that can mutate the
// same chat state needs the same constraint so sequentialize() orders it.
// Callbacks are included: captcha progress, votes and leaderboards all read and
// rewrite chat-scoped state. Private chat commands stay unconstrained so long
// running admin flows (notably /broadcast_cancel) can still interleave.
export function getUpdateConstraint(ctx: Context): string | undefined {
  const key = ctx.chatId?.toString() ?? ctx.from?.id.toString();

  if (ctx.callbackQuery) return key;
  if (ctx.chat?.type === "private") return undefined;

  return key;
}
