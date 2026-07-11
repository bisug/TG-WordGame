import type { Context } from "grammy";

import { escapeHtmlEntities } from "./escape-html-entities";

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
