import { Composer, type Context, GrammyError, InputFile } from "grammy";
import type { ReactionTypeEmoji } from "grammy/types";
import satori from "satori";
import sharp from "sharp";
import z from "zod";

import { db } from "../config/db";
import { redis } from "../config/redis";
import allFiveWords from "../data/all-five.json";
import allFourWords from "../data/all-four.json";
import allSixWords from "../data/all-six.json";
import { getGameDateString } from "../services/daily-wordle-cron";
import {
  addGamePlayer,
  deleteCachedGame,
  getCachedDailyWord,
  getCachedGame,
} from "../util/cache";
import { getFeedback } from "../util/feedback";
import { getFontData, prewarmFont } from "../util/font-cache";
import { formatDailyWordDetails } from "../util/format-word-details";
import { safeJsonParse, toFancyText } from "../util/formatting";
import { requireAllowedTopic, runGuards } from "../util/guards";
import { MemoryTtlCache } from "../util/memory-cache";
import { computeStreakAfterWin } from "../util/streak";
import { rateLimit, trackGuessSpeed } from "./anticheat";

// Pre-warm font on module load to avoid blocking on first image generation
prewarmFont();

// Cache for generated Wordle images (in-memory, short TTL)
const imageCache = new MemoryTtlCache<Buffer>(5 * 60 * 1000); // 5 minutes

function getImageCacheKey(guesses: GuessEntry[], solution: string): string {
  const guessPattern = guesses.map((g) => g.guess).join("|");
  return `wordle:${solution}:${guessPattern}`;
}

const composer = new Composer();

type WordLength = 4 | 5 | 6;

const ALL_WORDS_SET: Record<WordLength, Set<string>> = {
  4: new Set(allFourWords),
  5: new Set(allFiveWords),
  6: new Set(allSixWords),
};

const MODE_LABEL: Record<WordLength, string> = {
  4: "4-letter mode",
  5: "5-letter mode",
  6: "6-letter mode",
};

export const dailyWordleSchema = z.object({
  dailyWordId: z.number(),
  date: z.string(),
});

composer.on("message:text", rateLimit("guess"), async (ctx) => {
  const currentGuess = ctx.message.text?.toLowerCase();

  const isValidWord = /^[a-z]{4,6}$/.test(currentGuess ?? "");

  if (!isValidWord || currentGuess.startsWith("/")) {
    return;
  }

  const userId = ctx.from.id.toString();
  const chatId = ctx.chat.id.toString();

  if (ctx.chat.type === "private") {
    const dailyGameData = await redis.get(`daily_wordle:${userId}`);
    const result = dailyWordleSchema.safeParse(
      safeJsonParse(dailyGameData, {}),
    );
    if (result.success) {
      const todayDate = getGameDateString();

      if (result.data.date !== todayDate) {
        await redis.del(`daily_wordle:${userId}`);
        return ctx.reply(
          "Your previous game has expired. Please start today's WordSeek with /daily",
        );
      }

      return handleDailyWordleGuess(ctx, currentGuess);
    }
  }

  const currentTopicId = ctx.msg.message_thread_id?.toString() || "general";
  const chatIdStr = ctx.chat.id.toString();

  const currentGame = await getCachedGame(chatIdStr, currentTopicId);

  if (!currentGame) return;

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return;

  const wordLength = currentGame.word.length as WordLength;
  const validWords = ALL_WORDS_SET[wordLength];

  if (currentGuess.length !== wordLength) return;

  if (!validWords.has(currentGuess))
    return ctx.reply(
      `${currentGuess} is not a valid ${wordLength}-letter word.`,
    );

  const existingGuesses = await db
    .selectFrom("guesses")
    .selectAll()
    .where("gameId", "=", currentGame.id)
    .orderBy("createdAt", "asc")
    .execute();

  if (existingGuesses.some((g) => g.guess === currentGuess))
    return ctx.reply(
      "Someone has already guessed your word. Please try another one!",
    );

  // Record the guesser as a participant for the end-game vote threshold.
  await addGamePlayer(chatIdStr, currentTopicId, userId);

  if (currentGuess === currentGame.word) {
    // Atomically claim the win: only the first correct guess deletes the game
    // and scores, preventing a double award under concurrent correct guesses.
    const deletedGame = await db
      .deleteFrom("games")
      .where("id", "=", currentGame.id)
      .returning("id")
      .executeTakeFirst();

    if (!deletedGame) return;

    if (!ctx.from.is_bot) {
      const score = 30 - existingGuesses.length;
      const additionalMessage = `Added ${score} to the leaderboard.`;

      await db
        .insertInto("leaderboard")
        .values({
          score,
          chatId,
          userId,
          wordLength: wordLength.toString() as "4" | "5" | "6",
        })
        .execute();

      const formattedResponse = `<blockquote>Congrats! You guessed it correctly.\nCorrect Word: <b>${currentGuess}</b>\n${additionalMessage}</blockquote>\nStart with /new${wordLength}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message.message_id },
        parse_mode: "HTML",
      });
    } else {
      const additionalMessage = `Anonymous admins or channels don't get points.`;

      const formattedResponse = `<blockquote>Congrats! You guessed it correctly.\nCorrect Word: <b>${currentGuess}</b>\n</blockquote>${additionalMessage}\nStart with /new${wordLength}`;

      ctx.reply(formattedResponse, {
        reply_parameters: { message_id: ctx.message.message_id },
        parse_mode: "HTML",
      });
    }

    reactWithRandom(ctx);
    await deleteCachedGame(chatIdStr, currentTopicId);
    return;
  }

  const insertedGuess = await db
    .insertInto("guesses")
    .values({
      gameId: currentGame.id,
      guess: currentGuess,
      chatId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  const allGuesses = [...existingGuesses, insertedGuess];

  // Track guess speed for bot detection (only for non-bots)
  if (!ctx.from.is_bot) {
    await trackGuessSpeed(userId, chatIdStr, currentTopicId);
  }

  if (allGuesses.length === 30) {
    await db.deleteFrom("games").where("id", "=", currentGame.id).execute();
    await deleteCachedGame(chatIdStr, currentTopicId);
    return ctx.reply(
      "Game Over! The word was " +
        currentGame.word +
        `\nYou can start a new game with /new${wordLength}`,
    );
  }

  const modeLabel = MODE_LABEL[wordLength];
  const responseMessage =
    `<i>${modeLabel} · ${allGuesses.length}/30</i>\n\n` +
    toFancyText(getFeedback(allGuesses, currentGame.word));

  ctx.reply(responseMessage, {
    parse_mode: "HTML",
  });
});

async function handleDailyWordleGuess(ctx: Context, currentGuess: string) {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    return ctx.reply(
      "Unable to identify your account. Please start a private chat with the bot.",
    );
  }

  if (!ALL_WORDS_SET[5].has(currentGuess)) {
    return ctx.reply(`${currentGuess.toUpperCase()} is not a valid word.`);
  }

  const todayDate = getGameDateString();

  // Use cached daily word to reduce DB queries
  const dailyWord = await getCachedDailyWord(todayDate);

  if (!dailyWord) {
    return ctx.reply(
      "Today's WordSeek is not available. Please try again later.",
    );
  }

  const existingGuesses = await db
    .selectFrom("dailyGuesses")
    .selectAll()
    .where("userId", "=", userId)
    .where("dailyWordId", "=", dailyWord.id)
    .orderBy("attemptNumber", "asc")
    .execute();

  if (existingGuesses.some((g) => g.guess === currentGuess)) {
    return ctx.reply("You've already guessed this word. Try a different one!");
  }

  let insertedGuess: GuessEntry;
  try {
    const attemptNumber = existingGuesses.length + 1;
    insertedGuess = await db
      .insertInto("dailyGuesses")
      .values({
        userId,
        dailyWordId: dailyWord.id,
        guess: currentGuess,
        attemptNumber,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  } catch (_error) {
    // Handle race condition where two messages arrive nearly simultaneously
    // (or a duplicate guess slips past the in-memory check).
    return ctx.reply("You've already guessed this word. Try a different one!");
  }

  const allGuesses = [...existingGuesses, insertedGuess];

  if (currentGuess === dailyWord.word) {
    await handleDailyWordleWin(ctx, dailyWord, allGuesses);
    return;
  }

  if (allGuesses.length >= 6) {
    await handleDailyWordleLoss(ctx, dailyWord, allGuesses);
    return;
  }

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const attemptsLeft = 6 - allGuesses.length;

  await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
    caption: `${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} remaining`,
  });
}

type DailyWord = {
  date: Date;
  dayNumber: number;
  meaning: string | null;
  phonetic: string | null;
  sentence: string | null;
  word: string;
};
async function handleDailyWordleWin(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    return;
  }

  await redis.del(`daily_wordle:${userId}`);

  const userStats = await db
    .selectFrom("userStats")
    .selectAll()
    .where("userId", "=", userId)
    .executeTakeFirst();

  const todayGameDay = getGameDateString();
  const yesterdayGameDay = getGameDateString(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
  );

  const { newStreak, highestStreak } = computeStreakAfterWin({
    lastGuessGameDay: userStats?.lastGuessed
      ? getGameDateString(new Date(userStats.lastGuessed))
      : null,
    currentStreak: userStats?.currentStreak ?? 0,
    highestStreak: userStats?.highestStreak ?? 0,
    todayGameDay,
    yesterdayGameDay,
  });

  await db
    .insertInto("userStats")
    .values({
      userId,
      currentStreak: newStreak,
      highestStreak: highestStreak,
      lastGuessed: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column("userId").doUpdateSet({
        currentStreak: newStreak,
        highestStreak: highestStreak,
        lastGuessed: new Date().toISOString(),
      }),
    )
    .execute();

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    allGuesses,
    dailyWord.word,
  );

  await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
    caption: `🎉 Congratulations! You guessed it in ${allGuesses.length} ${allGuesses.length === 1 ? "try" : "tries"}!\n\n🔥 Current Streak: ${newStreak}\n⭐ Highest Streak: ${highestStreak}\n\n${formatDailyWordDetails(dailyWord)}`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📤 Share",
            switch_inline_query: shareText,
          },
        ],
      ],
    },
  });

  reactWithRandom(ctx);
}

export function generateWordleShareText(
  dayNumber: number,
  guesses: GuessEntry[],
  solution: string,
) {
  const totalAttempts = guesses.length;
  const attemptLine = `${dayNumber} ${totalAttempts}/6`;

  const lines = guesses.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const sol = solution.toUpperCase();
    const result: string[] = [];

    const solutionCount: Record<string, number> = {};

    for (const c of sol) {
      solutionCount[c] = (solutionCount[c] || 0) + 1;
    }

    for (let i = 0; i < guess.length; i++) {
      const gChar = guess[i];
      const sChar = sol[i];
      if (gChar && sChar && gChar === sChar) {
        result[i] = "🟩";
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      }
    }

    for (let i = 0; i < guess.length; i++) {
      if (result[i]) continue;
      const gChar = guess[i];
      if (gChar && (solutionCount[gChar] ?? 0) > 0) {
        result[i] = "🟨";
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      } else {
        result[i] = "⬛";
      }
    }

    return result.join("");
  });

  return `WordSeek ${attemptLine}\n\n${lines.join("\n")}\nTry yourself by using /daily command.`;
}

async function handleDailyWordleLoss(
  ctx: Context,
  dailyWord: DailyWord,
  allGuesses: GuessEntry[],
) {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    return;
  }

  await redis.del(`daily_wordle:${userId}`);

  await db
    .insertInto("userStats")
    .values({
      userId,
      currentStreak: 0,
      lastGuessed: new Date().toISOString(),
    })
    .onConflict((oc) =>
      oc.column("userId").doUpdateSet({
        currentStreak: 0,
        lastGuessed: new Date().toISOString(),
      }),
    )
    .execute();

  const imageBuffer = await generateWordleImage(allGuesses, dailyWord.word);
  const shareText = generateWordleShareText(
    dailyWord.dayNumber,
    allGuesses,
    dailyWord.word,
  );

  await ctx.replyWithPhoto(new InputFile(new Uint8Array(imageBuffer)), {
    caption: `Game Over! The word was: ${dailyWord.word.toUpperCase()}\n\n💔 Streak reset to 0\n\n${formatDailyWordDetails(dailyWord)}\n\nCome back tomorrow for a new challenge!`,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📤 Share",
            switch_inline_query: shareText,
          },
        ],
      ],
    },
  });
}

export const onMessageHandler = composer;

interface GuessEntry {
  id: number;
  guess: string;
  gameId?: number;
  dailyWordId?: number;
  attemptNumber?: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function generateWordleImage(
  data: GuessEntry[],
  solution: string,
) {
  // Check cache first
  const cacheKey = getImageCacheKey(data, solution);
  const cached = imageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const tiles = data.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const solutionCount: Record<string, number> = {};

    for (const char of solution.toUpperCase()) {
      solutionCount[char] = (solutionCount[char] || 0) + 1;
    }

    const result = Array(guess.length).fill("absent");

    for (let i = 0; i < guess.length; i++) {
      const gChar = guess[i];
      const sChar = solution[i]?.toUpperCase();
      if (gChar && sChar && gChar === sChar) {
        result[i] = "correct";
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      }
    }

    for (let i = 0; i < guess.length; i++) {
      const gChar = guess[i];
      if (gChar && result[i] === "absent" && (solutionCount[gChar] ?? 0) > 0) {
        result[i] = "present";
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      }
    }

    return { guess, result };
  });

  const getColor = (state: string) => {
    if (state === "correct") return "#538d4e";
    if (state === "present") return "#b59f3b";
    return "#3a3a3c";
  };

  const fontData = await getFontData();

  const tileSize = 60;
  const gap = 8;
  const padding = 20;

  const columnWidth = solution.length * tileSize + (solution.length - 1) * gap;
  const width = padding * 2 + columnWidth;
  const height = padding * 2 + 6 * tileSize + 5 * gap; // Always 6 rows for daily wordle

  // Pad with empty rows if less than 6 guesses
  const buildCells = (rowKey: string, guess: string, result: string[]) =>
    guess.split("").map((letter, cellIndex) => ({
      key: `${rowKey}-${cellIndex}-${letter || "blank"}`,
      letter,
      status: result[cellIndex] ?? "empty",
    }));

  const paddedTiles = tiles.map((tile, index) => {
    const rowKey = `guess-${index}-${tile.guess}-${tile.result.join("")}`;
    return {
      rowKey,
      cells: buildCells(rowKey, tile.guess, tile.result),
    };
  });
  while (paddedTiles.length < 6) {
    const rowKey = `empty-${paddedTiles.length}`;
    paddedTiles.push({
      rowKey,
      cells: buildCells(rowKey, "     ", Array(5).fill("empty")),
    });
  }

  const svg = await satori(
    <div
      style={{
        display: "flex",
        background: "#121213",
        padding: "20px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {paddedTiles.map(({ cells, rowKey }) => (
          <div key={rowKey} style={{ display: "flex", gap: "8px" }}>
            {cells.map(({ key, letter, status }) => (
              <div
                key={key}
                style={{
                  width: "60px",
                  height: "60px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: status === "empty" ? "#3a3a3c" : getColor(status),
                  color: status === "empty" ? "#3a3a3c" : "white",
                  fontSize: "32px",
                  fontWeight: "bold",
                  border: status === "empty" ? "2px solid #565758" : "none",
                }}
              >
                {letter.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    {
      width,
      height,
      fonts: [
        {
          name: "Roboto",
          data: fontData,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );

  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  // Cache the result
  imageCache.set(cacheKey, pngBuffer);

  return pngBuffer;
}

const REACTION_EMOJIS: ReactionTypeEmoji["emoji"][] = [
  "🎉",
  "🏆",
  "🤩",
  "⚡",
  "🫡",
  "💯",
  "❤‍🔥",
  "🦄",
];

async function reactWithRandom(ctx: Context) {
  // Copy before sorting so the module-level list is never mutated.
  const shuffled = [...REACTION_EMOJIS].sort(() => Math.random() - 0.5);

  for (const emoji of shuffled) {
    try {
      await ctx.react(emoji);
      return;
    } catch (err) {
      const notAllowed =
        err instanceof GrammyError &&
        err.description?.includes("REACTION_NOT_ALLOWED");
      if (!notAllowed) break;
      // Emoji not available in this chat; try the next one.
    }
  }
}
