import { type ExpressionBuilder, sql } from "kysely";
import type { AllowedWordLength } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import type { DB } from "../database-schemas";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { getZonedPeriodStart } from "../util/timezone";

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

  const excludeBanned = (eb: ExpressionBuilder<DB, "leaderboard">) =>
    eb.not(
      eb.exists(
        eb
          .selectFrom("bannedUsers")
          .select("userId")
          .whereRef("bannedUsers.userId", "=", "leaderboard.userId"),
      ),
    );

  // The user's own total within the competing scope. groupBy makes the
  // aggregate yield zero rows (instead of one coalesced 0 row) when the user
  // has no matching scores, so the undefined contract below actually holds
  // and callers show a "no scores yet" message instead of "0 pts, rank #1".
  const myRow = await db
    .selectFrom("leaderboard")
    .select(
      sql<number>`coalesce(sum(${sql.ref("leaderboard.score")}), 0)`.as(
        "totalScore",
      ),
    )
    .where("wordLength", "=", wordLength.toString() as "4" | "5" | "6")
    .$if(searchKey === "group", (q) => q.where("chatId", "=", chatId))
    .$if(start !== null, (q) => q.where("createdAt", ">=", start))
    .where(excludeBanned)
    .where("userId", "=", userId)
    .groupBy("userId")
    .executeTakeFirst();

  if (!myRow) return undefined;

  const totalScore = Number(myRow.totalScore);

  // Competition rank = (# competitors with strictly greater score) + 1. This is
  // O(indexed aggregates) instead of the old O(N log N) rank() window over the
  // entire leaderboard, and yields identical ranking including ties.
  const [betterRows, profile] = await Promise.all([
    db
      .selectFrom("leaderboard")
      .select(sql<number>`count(*)`.as("cnt"))
      .where("wordLength", "=", wordLength.toString() as "4" | "5" | "6")
      .$if(searchKey === "group", (q) => q.where("chatId", "=", chatId))
      .$if(start !== null, (q) => q.where("createdAt", ">=", start))
      .where(excludeBanned)
      .groupBy("userId")
      .having(sql`sum(${sql.ref("leaderboard.score")})`, ">", totalScore)
      .execute(),
    db
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
      .executeTakeFirst(),
  ]);

  const rank = betterRows.length + 1;

  return profile ? { ...profile, totalScore, rank } : undefined;
}
