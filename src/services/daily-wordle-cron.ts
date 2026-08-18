import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import words from "../data/daily-word-lists.json";
import { getLocalWordDetails } from "../util/local-word-details";
import { getZonedInstant } from "../util/timezone";

function getDateStringFromDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The game day is defined as starting at 06:00 local time in env.TIME_ZONE.
// Returns the "YYYY-MM-DD" game-day string for the given instant (defaults to
// now). Uses local calendar arithmetic so it is correct regardless of the
// server's own timezone.
export function getGameDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (t: string) => {
    const value = parts.find((p) => p.type === t)?.value;
    if (!value) throw new Error(`Missing ${t} from formatted game date`);
    return value;
  };

  const dateString = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);

  if (hour < 6) {
    const [yearPart, monthPart, dayPart] = dateString.split("-");
    if (!yearPart || !monthPart || !dayPart) return dateString;

    const shifted = new Date(
      Number(yearPart),
      Number(monthPart) - 1,
      Number(dayPart),
    );
    shifted.setDate(shifted.getDate() - 1);
    return getDateStringFromDate(shifted);
  }

  return dateString;
}

export const getCurrentGameDateString = getGameDateString;

// Build a UTC-midnight Date for a "YYYY-MM-DD" game-day string. Used for both
// inserting and querying dailyWords.date so the two always agree regardless of
// the Postgres session timezone.
export function toUtcMidnight(datePart: string): Date {
  return new Date(`${datePart}T00:00:00Z`);
}

async function resetStreaksForInactivePlayers(yesterdayDate: string) {
  try {
    logger.info(
      { date: yesterdayDate },
      `Resetting streaks for inactive players`,
    );

    const yesterdayStartTime = getZonedInstant(
      yesterdayDate,
      "06:00:00",
      env.TIME_ZONE,
    );

    const result = await db
      .updateTable("userStats")
      .set({ currentStreak: 0 })
      .where("currentStreak", ">", 0)
      .where((eb) =>
        eb.or([
          eb("lastGuessed", "is", null),
          eb("lastGuessed", "<", yesterdayStartTime),
        ]),
      )
      .execute();

    const resetCount = result.reduce(
      (sum, r) => sum + Number(r.numUpdatedRows || 0n),
      0,
    );

    if (resetCount > 0) {
      logger.info({ count: resetCount }, `Reset streaks for inactive players`);
    } else {
      logger.info("No inactive players found to reset");
    }
  } catch (error) {
    logger.error(
      { err: error },
      "Error resetting streaks for inactive players",
    );
  }
}

async function generateDailyWordInternal(gameDate: string) {
  const existingWord = await db
    .selectFrom("dailyWords")
    .selectAll()
    .where("date", "=", toUtcMidnight(gameDate))
    .executeTakeFirst();

  if (existingWord) return existingWord;

  const word = getRandomWordForDate(gameDate);
  const details = getLocalWordDetails(word);

  const insertedWord = await db
    .insertInto("dailyWords")
    .values({
      word,
      date: toUtcMidnight(gameDate),
      meaning: details.meaning,
      phonetic: details.phonetic,
      sentence: details.sentence,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const yesterday = new Date(gameDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = getDateStringFromDate(yesterday);

  await resetStreaksForInactivePlayers(yesterdayString);

  logger.info(
    { word, date: gameDate, hasDetails: Boolean(details.meaning) },
    `Successfully generated daily word`,
  );
  return insertedWord;
}

async function generateDailyWord() {
  try {
    const gameDate = getCurrentGameDateString();
    logger.info(
      { gameDate, time: new Date().toISOString() },
      "Generating daily word",
    );

    await generateDailyWordInternal(gameDate);
  } catch (error) {
    logger.error({ err: error }, "Error generating daily word");
  }
}

export async function ensureDailyWordExists(gameDate?: string) {
  try {
    const dateToUse = gameDate ?? getCurrentGameDateString();
    return await generateDailyWordInternal(dateToUse);
  } catch (error) {
    logger.error({ err: error }, "Error ensuring daily word exists");
    return null;
  }
}

function getRandomWordForDate(gameDate: string): string {
  if (words.length === 0) {
    throw new Error("Daily word list is empty");
  }

  // Use date string to get a consistent but pseudo-random word for the day
  const msPerDay = 24 * 60 * 60 * 1000;
  const targetDate = new Date(`${gameDate}T00:00:00Z`);
  const dayNumber = Math.floor(
    (targetDate.getTime() - env.DAILY_WORDLE_START_DATE.getTime()) / msPerDay,
  );

  // Simple hash-based selection for consistency
  const hash = (dayNumber * 2654435761) >>> 0; // Knuth multiplicative hash
  const index = hash % words.length;
  const word = words[index];
  if (!word) throw new Error(`No daily word found for index ${index}`);
  return word;
}

function scheduleNextDailyRun(fn: () => void | Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function planNext() {
    // The game day rolls over at 06:00 in env.TIME_ZONE, NOT in the server's
    // local timezone. Anchor the next run to 06:00 of the day after the
    // current game day, resolved in env.TIME_ZONE (DST-safe via
    // getZonedInstant). Using setHours(6) here previously fired at the wrong
    // instant whenever server TZ != env.TIME_ZONE, making the cron a no-op.
    const gameDay = getGameDateString();
    const nextDay = new Date(`${gameDay}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextDatePart = nextDay.toISOString().slice(0, 10);

    const target = getZonedInstant(nextDatePart, "06:00:00", env.TIME_ZONE);
    let msUntilTarget = target.getTime() - Date.now();

    // Safety net for clock skew: never schedule in the past, retry shortly.
    if (msUntilTarget <= 0) msUntilTarget = 60_000;

    timer = setTimeout(async () => {
      try {
        await fn();
      } finally {
        planNext();
      }
    }, msUntilTarget);
  }

  return {
    start() {
      if (!timer) {
        planNext();
      }
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export const dailyWordleCron = scheduleNextDailyRun(generateDailyWord);
