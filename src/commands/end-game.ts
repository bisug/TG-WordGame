import { Composer, type Context } from "grammy";

import { db } from "../config/db";
import { env } from "../config/env";
import { redis } from "../config/redis";
import { deleteCachedGame, getGamePlayerCount } from "../util/cache";
import { CommandsHelper } from "../util/commands-helper";
import {
  formatUserLink,
  getCurrentTopicId,
  getEndVoteKey,
  getEndVoteThreshold,
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
  const isPrivate = ctx.chat.type === "private";

  // getChatMember is only valid in group/supergroup chats; calling it in a
  // private chat throws. Private chats need no permission check anyway.
  let isAdmin = false;
  if (!isPrivate) {
    const chatMember = await ctx.getChatMember(parseInt(userId, 10));
    isAdmin =
      chatMember.status === "administrator" || chatMember.status === "creator";
  }
  const isSystemAdmin = env.ADMIN_USERS.includes(ctx.from.id);
  const isGameStarter = currentGame.startedBy === userId;
  const isAuthorized = await isUserAuthorized(userId, chatId.toString());

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

  // Scale the threshold with the number of participants so small groups
  // (1-2 players) can actually finish a vote. Falls back to 3 when the
  // player count is unknown.
  const playerCount = await getGamePlayerCount(String(chatId), topicId);
  const threshold = getEndVoteThreshold(playerCount);

  // Store voters as a Redis SET so concurrent votes are counted atomically.
  // Pipeline the ops so a crash can't leave the key without a TTL. The
  // threshold is stored alongside so the callback handler applies the same
  // value that was announced when the vote started.
  const voteSetup = redis.pipeline();
  voteSetup.del(voteKey);
  voteSetup.sadd(voteKey, userId);
  voteSetup.set(`${voteKey}:threshold`, threshold);
  voteSetup.expire(voteKey, 300); // 5 minutes expiry
  voteSetup.expire(`${voteKey}:threshold`, 300);
  await voteSetup.exec();

  const userLink = formatUserLink(
    ctx.from.id,
    ctx.from.first_name,
    ctx.from.last_name,
  );

  // A single-participant game needs only one vote (the initiator's), so the
  // vote passes immediately instead of posting an unwinnable poll.
  if (threshold <= 1) {
    await redis.del(voteKey);
    await redis.del(`${voteKey}:threshold`);
    return await endGame(
      ctx,
      chatId,
      currentGame.topicId,
      currentGame.word,
      "<b>Game ended - vote to end the game passed</b>",
    );
  }

  await ctx.reply(
    `<b>🗳️ Vote to End Game</b>\n\n` +
      `${userLink} wants to end the game.\n\n` +
      `<b>Votes needed: ${threshold} out of remaining players</b>\n` +
      `<b>Current votes: 1/${threshold}</b>\n\n` +
      `React with the button below to vote for ending the game.`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `✅ Vote to End (1/${threshold})`,
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
