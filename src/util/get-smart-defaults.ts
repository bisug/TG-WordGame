import type { AllowedWordLength } from "../config/constants";
import { db } from "../config/db";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { getZonedPeriodStart } from "./timezone";

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

  // Always fetch both scopes in parallel — cheaper than two sequential queries
  const [groupStats, globalStats] = await Promise.all([
    db
      .selectFrom("leaderboard")
      .select([
        "wordLength",
        db.fn.max<Date>("createdAt").as("latestCreatedAt"),
      ])
      .where("userId", "=", userId)
      .where("chatId", "=", chatId)
      .groupBy("wordLength")
      .execute(),
    db
      .selectFrom("leaderboard")
      .select([
        "wordLength",
        db.fn.max<Date>("createdAt").as("latestCreatedAt"),
      ])
      .where("userId", "=", userId)
      .groupBy("wordLength")
      .execute(),
  ]);

  const groupStatsMap = new Map(
    groupStats.map((s) => [s.wordLength as string, s.latestCreatedAt]),
  );

  // Downgrade to global only if no group scores exist
  if (searchKey === "group" && groupStatsMap.size === 0) {
    searchKey = "global";
  }

  const statsMap =
    searchKey === "group"
      ? groupStatsMap
      : new Map(
          globalStats.map((s) => [s.wordLength as string, s.latestCreatedAt]),
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
  // Compare against the exact zoned period boundaries the score queries use
  // (getZonedPeriodStart, Monday-anchored weeks in env.TIME_ZONE). The old
  // server-local, Sunday-anchored math labeled Sunday scores "week" while the
  // query excluded them, and drifted whenever server TZ != env.TIME_ZONE.
  for (const key of ["today", "week", "month", "year"] as const) {
    if (latestDate >= getZonedPeriodStart(key)) return key;
  }
  return "all";
}
