import type { Context } from "grammy";

import { escapeHtmlEntities } from "./formatting";

export function getCurrentTopicId(ctx: Context) {
  return ctx.msg?.message_thread_id?.toString() || "general";
}

export function getEndVoteKey(chatId: string | number, topicId: string) {
  return `vote:${chatId}:${topicId}`;
}

export function formatUserLink(
  id: number,
  firstName: string,
  lastName?: string,
) {
  const name = escapeHtmlEntities(firstName + (lastName ? ` ${lastName}` : ""));
  return `<a href="tg://user?id=${id}">${name}</a>`;
}

// Votes required to end a game by vote. A hardcoded 3 made the vote
// unwinnable in 1-2 person groups, so scale with the number of players:
// strict majority of participants, capped at 3, minimum 1. Unknown player
// counts (0) fall back to the legacy threshold of 3.
export function getEndVoteThreshold(playerCount: number): number {
  if (playerCount <= 0) return 3;
  return Math.max(1, Math.min(3, Math.floor(playerCount / 2) + 1));
}
