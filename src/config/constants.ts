import { env } from "./env";

export const UPDATES_CHANNEL = env.UPDATES_CHANNEL;
export const DISCUSSION_GROUP = env.DISCUSSION_GROUP;
export const DONATION_LINK = "https://buymemomo.com/binamra";

export const allowedChatSearchKeys = ["global", "group"] as const;
export const allowedChatTimeKeys = [
  "today",
  "week",
  "month",
  "year",
  "all",
] as const;

export type AllowedWordLength = 4 | 5 | 6;
export const allowedWordLengths: AllowedWordLength[] = [4, 5, 6];

export const SLOT_SYMBOLS = ["➖", "🍒", "🍋", "7️⃣"] as const;
