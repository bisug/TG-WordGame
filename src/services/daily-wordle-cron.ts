import crypto from "crypto";

import { db } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import words from "../data/daily-word-lists.json";
import { getZonedInstant } from "../util/timezone";
import { getLocalWordDetails } from "../util/local-word-details";

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
  const get = (t: string) => parts.find((p) => p.type === t)!.value;

  const dateString = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);

  if (hour < 6) {
    const [y, m, d] = dateString.split("-").map(Number);
    const shifted = new Date(y, m - 1, d);
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

  const seed = seedFromSecret(env.DAILY_WORDLE_SECRET);
  const shuffled = deterministicShuffle(seed);
  const word = getWordOfTheDay(shuffled, gameDate);
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

function seedFromSecret(secret: string) {
  const h = crypto
    .createHmac("sha256", secret)
    .update("wotd-permutation-seed")
    .digest();
  return h.readUInt32BE(0);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(seed: number) {
  const arr = words.slice();
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getWordOfTheDay(shuffled: string[], gameDate: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const targetDate = new Date(gameDate + "T00:00:00Z");

  const dayNumber = Math.floor(
    (targetDate.getTime() - env.DAILY_WORDLE_START_DATE.getTime()) / msPerDay,
  );

  return shuffled[
    ((dayNumber % shuffled.length) + shuffled.length) % shuffled.length
  ];
}

function scheduleNextDailyRun(fn: () => void | Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function planNext() {
    const now = new Date();
    const target = new Date();
    target.setHours(6, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const msUntilTarget = target.getTime() - now.getTime();

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
