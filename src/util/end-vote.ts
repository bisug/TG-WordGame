import type { Context } from "grammy";

import { escapeHtmlEntities } from "./escape-html-entities";

export type EndVoteData = {
  voters: string[];
  initiatedAt: number;
};

export function getCurrentTopicId(ctx: Context) {
  return ctx.msg?.message_thread_id?.toString() || "general";
}

export function getEndVoteKey(chatId: string | number, topicId: string) {
  return `vote:${chatId}:${topicId}`;
}

export function parseEndVoteData(raw: string | null): EndVoteData | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<EndVoteData>;
    if (!Array.isArray(parsed.voters)) return null;
    if (!parsed.voters.every((v) => typeof v === "string")) return null;
    if (typeof parsed.initiatedAt !== "number") return null;

    return {
      voters: parsed.voters,
      initiatedAt: parsed.initiatedAt,
    };
  } catch {
    return null;
  }
}

export function formatUserLink(
  id: number,
  firstName: string,
  lastName?: string,
) {
  const name = escapeHtmlEntities(firstName + (lastName ? ` ${lastName}` : ""));
  return `<a href="tg://user?id=${id}">${name}</a>`;
}
