import { Composer, type Context } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { deleteCachedGame } from "../util/cache";
import { CommandsHelper } from "../util/commands-helper";
import {
  formatUserLink,
  getCurrentTopicId,
  getEndVoteKey,
} from "../util/end-vote";
import { requireAllowedTopic, runGuards } from "../util/guards";

const composer = new Composer();

export async function isUserAuthorized(userId: string, chatId: string) {
  const authorized = await db
    .selectFrom("authorizedUsers")
    .where("userId", "=", userId)
    .where("chatId", "=", chatId)
    .executeTakeFirst();

  return !!authorized;
}

export async function endGame(
  ctx: Context,
  chatId: number,
  topicId: string,
  word: string,
  reason: string,
) {
  const game = await db
    .deleteFrom("games")
    .where("activeChat", "=", String(chatId))
    .where("topicId", "=", topicId)
    .returning(["word", "topicId"])
    .executeTakeFirst();

  // A concurrent end (admin + vote, or two near-simultaneous votes) may have
  // already deleted the game; the second caller must not post again.
  if (!game) return;

  await deleteCachedGame(String(chatId), game.topicId);

  const wordLength = game.word.length;

  //   await ctx.reply(
  //     `<blockquote>🎮 <b>Game Ended</b></blockquote>
  // ${formatWordDetails(word)}<blockquote>${reason ? `${reason}\n` : ""}Start a new game with /new</blockquote>`,
  //     { parse_mode: "HTML" },
  //   );

  await ctx.reply(
    `<blockquote>🎮 <b>Game Ended</b>\nCorrect Word: <b>${word}</b></blockquote>
<blockquote>${reason ? `${reason}\n` : ""}Start a new game with /new${wordLength}</blockquote>`,
    { parse_mode: "HTML" },
  );
}

composer.command("end", async (ctx) => {
  const chatId = ctx.chat.id;
  if (!ctx.message) return;
  const topicId = getCurrentTopicId(ctx);

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return ctx.reply(guard.message);

  const currentGame = await db
    .selectFrom("games")
    .selectAll()
    .where("activeChat", "=", String(ctx.chat.id))
    .where("topicId", "=", topicId)
    .executeTakeFirst();

  if (!currentGame) return ctx.reply("There is no game in progress.");

  const userId = ctx.from.id.toString();
  const chatMember = await ctx.getChatMember(parseInt(userId, 10));

  const isAdmin =
    chatMember.status === "administrator" || chatMember.status === "creator";
  const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
  const isGameStarter = currentGame.startedBy === userId;
  const isAuthorized = await isUserAuthorized(userId, chatId.toString());
  const isPrivate = ctx.chat.type === "private";

  const isPermitted =
    isAdmin || isSystemAdmin || isGameStarter || isAuthorized || isPrivate;

  if (isPermitted) {
    const userLink = formatUserLink(
      ctx.from.id,
      ctx.from.first_name,
      ctx.from.last_name,
    );

    let reason = "";

    if (isPrivate) {
      reason = "";
    } else if (isGameStarter) {
      reason = `<b>Ended by game starter: </b>${userLink}`;
    } else if (isSystemAdmin) {
      reason = `<b>Ended by system administrator: </b>${userLink}`;
    } else if (isAdmin) {
      reason = `<b>Ended by group administrator: </b>${userLink}`;
    } else if (isAuthorized) {
      reason = `<b>Ended by authorized user: </b>${userLink}`;
    } else {
      reason = `<b>Ended by: </b>${userLink}`;
    }

    return await endGame(
      ctx,
      chatId,
      currentGame.topicId,
      currentGame.word,
      reason,
    );
  }

  const voteKey = getEndVoteKey(chatId, topicId);
  const existingVotes = await redis.scard(voteKey);

  if (existingVotes > 0) {
    return await ctx.reply(
      "⏳ A vote to end the game is already in progress. Please wait for it to complete.",
    );
  }

  // Store voters as a Redis SET so concurrent votes are counted atomically.
  // Pipeline the three ops so a crash can't leave the key without a TTL.
  const voteSetup = redis.pipeline();
  voteSetup.del(voteKey);
  voteSetup.sadd(voteKey, userId);
  voteSetup.expire(voteKey, 300); // 5 minutes expiry
  await voteSetup.exec();

  const userLink = formatUserLink(
    ctx.from.id,
    ctx.from.first_name,
    ctx.from.last_name,
  );

  await ctx.reply(
    `<b>🗳️ Vote to End Game</b>\n\n` +
      `${userLink} wants to end the game.\n\n` +
      `<b>Votes needed: 3 out of remaining players</b>\n` +
      `<b>Current votes: 1/3</b>\n\n` +
      `React with the button below to vote for ending the game.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Vote to End (1/3)",
              callback_data: `vote_end ${chatId} ${topicId}`,
            },
          ],
        ],
      },
    },
  );
});

CommandsHelper.addNewCommand(
  "end",
  "End the current game. Available for only admins in groups.",
);

export const endGameCommand = composer;
