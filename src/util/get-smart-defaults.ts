import type { AllowedWordLength } from "../config/constants";
import { db } from "../config/db";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export async function getSmartDefaults({
  userId,
  chatId,
  requestedSearchKey,
  requestedTimeKey,
  requestedWordLength,
  chatType,
}: {
  userId: string;
  chatId: string;
  requestedSearchKey?: AllowedChatSearchKey;
  requestedTimeKey?: AllowedChatTimeKey;
  requestedWordLength?: AllowedWordLength;
  chatType: string;
}) {
  let searchKey: AllowedChatSearchKey =
    requestedSearchKey || (chatType === "private" ? "global" : "group");

  if (searchKey === "group" && chatType !== "private") {
    const groupScoresExist = await db
      .selectFrom("leaderboard")
      .select("userId")
      .where("userId", "=", userId)
      .where("chatId", "=", chatId)
      .limit(1)
      .executeTakeFirst();

    if (!groupScoresExist) {
      searchKey = "global";
    }
  }

  // Fetch all word lengths and their latest guess time in one query
  const stats = await db
    .selectFrom("leaderboard")
    .select(["wordLength", db.fn.max<Date>("createdAt").as("latestCreatedAt")])
    .where("userId", "=", userId)
    .$if(searchKey === "group", (qb) => qb.where("chatId", "=", chatId))
    .groupBy("wordLength")
    .execute();

  const statsMap = new Map(
    stats.map((s) => [s.wordLength as string, s.latestCreatedAt]),
  );

  let wordLength: AllowedWordLength = 5;
  if (requestedWordLength) {
    wordLength = requestedWordLength;
  } else {
    const preferenceOrder: AllowedWordLength[] = [5, 4, 6];
    for (const len of preferenceOrder) {
      if (statsMap.has(len.toString())) {
        wordLength = len;
        break;
      }
    }
  }

  const hasAnyScores = statsMap.has(wordLength.toString());
  let timeKey: AllowedChatTimeKey = "all";

  if (requestedTimeKey) {
    timeKey = requestedTimeKey;
  } else if (hasAnyScores) {
    const latestCreatedAt = statsMap.get(wordLength.toString());
    if (latestCreatedAt) {
      const latestDate = new Date(latestCreatedAt);
      timeKey = deriveTimeKey(latestDate);
    }
  }

  return { searchKey, timeKey, wordLength, hasAnyScores };
}

function deriveTimeKey(latestDate: Date): AllowedChatTimeKey {
  const now = new Date();

  if (
    latestDate.getFullYear() === now.getFullYear() &&
    latestDate.getMonth() === now.getMonth() &&
    latestDate.getDate() === now.getDate()
  ) {
    return "today";
  }

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  if (latestDate >= startOfWeek) return "week";

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (latestDate >= startOfMonth) return "month";

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  if (latestDate >= startOfYear) return "year";

  return "all";
}
