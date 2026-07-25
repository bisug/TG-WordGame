import { sql } from "kysely";
import type { AllowedWordLength } from "../config/constants";
import { db } from "../config/db";
import { env } from "../config/env";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { getZonedPeriodStart } from "../util/timezone";

export async function getLeaderboardScores({
  chatId,
  searchKey,
  timeKey,
  wordLength = 5,
}: {
  chatId: string;
  searchKey: AllowedChatSearchKey;
  timeKey: AllowedChatTimeKey;
  wordLength?: AllowedWordLength;
}) {
  let leaderboardQuery = db
    .selectFrom("leaderboard")
    .innerJoin("users", "users.id", "leaderboard.userId")
    .select((eb) => [
      "users.id as userId",
      "users.name as name",
      "users.username as username",
      sql<number>`cast(sum(${eb.ref("leaderboard.score")}) as integer)`.as(
        "totalScore",
      ),
    ])
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("bannedUsers")
            .select("userId")
            .whereRef("bannedUsers.userId", "=", "leaderboard.userId"),
        ),
      ),
    )
    .groupBy("users.id")
    .orderBy(sql`sum(${sql.ref("leaderboard.score")}) desc`)
    .where(
      "leaderboard.wordLength",
      "=",
      wordLength.toString() as "4" | "5" | "6",
    )
    .limit(20);

  if (searchKey === "group")
    leaderboardQuery = leaderboardQuery.where(
      "leaderboard.chatId",
      "=",
      chatId,
    );

  if (timeKey !== "all") {
    // Sargable range bound anchored to env.TIME_ZONE, so the window matches the
    // app's notion of day/week/month/year regardless of the Postgres server tz.
    const start = getZonedPeriodStart(timeKey, env.TIME_ZONE);
    leaderboardQuery = leaderboardQuery.where(
      "leaderboard.createdAt",
      ">=",
      start,
    );
  }

  return await leaderboardQuery.execute();
}
