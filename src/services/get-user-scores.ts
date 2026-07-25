import { sql } from "kysely";

import { db } from "../config/db";
import { env } from "../config/env";
import { getZonedPeriodStart } from "../util/timezone";
import type { AllowedWordLength } from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

export async function getUserScores({
  chatId,
  searchKey,
  userId,
  timeKey,
  wordLength = 5,
}: {
  chatId: string;
  searchKey: AllowedChatSearchKey;
  userId: string;
  timeKey: AllowedChatTimeKey;
  wordLength?: AllowedWordLength;
}) {
  const start =
    timeKey !== "all" ? getZonedPeriodStart(timeKey, env.TIME_ZONE) : null;

  const excludeBanned = (eb: any) =>
    eb.not(
      eb.exists(
        eb
          .selectFrom("bannedUsers")
          .select("userId")
          .whereRef("bannedUsers.userId", "=", "leaderboard.userId"),
      ),
    );

  // The user's own total within the competing scope. coalesce keeps it 0 even
  // when there is no row, but we still treat "no row" as undefined below to
  // preserve the original contract (callers show a "no scores yet" message).
  const myRow = await db
    .selectFrom("leaderboard")
    .select(
      sql<number>`coalesce(sum(${sql.ref("leaderboard.score")}), 0)`.as(
        "totalScore",
      ),
    )
    .where("wordLength", "=", wordLength.toString() as "4" | "5" | "6")
    .$if(searchKey === "group", (q) => q.where("chatId", "=", chatId))
    .$if(start !== null, (q) => q.where("createdAt", ">=", start!))
    .where(excludeBanned)
    .where("userId", "=", userId)
    .executeTakeFirst();

  if (!myRow) return undefined;

  const totalScore = Number(myRow.totalScore);

  // Competition rank = (# competitors with strictly greater score) + 1. This is
  // O(indexed aggregates) instead of the old O(N log N) rank() window over the
  // entire leaderboard, and yields identical ranking including ties.
  const betterRows = await db
    .selectFrom("leaderboard")
    .select(sql<number>`count(*)`.as("cnt"))
    .where("wordLength", "=", wordLength.toString() as "4" | "5" | "6")
    .$if(searchKey === "group", (q) => q.where("chatId", "=", chatId))
    .$if(start !== null, (q) => q.where("createdAt", ">=", start!))
    .where(excludeBanned)
    .groupBy("userId")
    .having(sql`sum(${sql.ref("leaderboard.score")})`, ">", totalScore)
    .execute();

  const rank = betterRows.length + 1;

  const profile = await db
    .selectFrom("users")
    .leftJoin("userStats", "userStats.userId", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.username",
      "userStats.highestStreak",
      "userStats.currentStreak",
    ])
    .where("users.id", "=", userId)
    .executeTakeFirst();

  return profile ? { ...profile, totalScore, rank } : undefined;
}
