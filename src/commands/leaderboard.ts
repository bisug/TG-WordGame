import { Composer } from "grammy";
import { getLeaderboardScores } from "../services/get-leaderboard-scores";
import { CommandsHelper } from "../util/commands-helper";
import { formatLeaderboardMessage } from "../util/format-leaderboard-message";
import { generateLeaderboardKeyboard } from "../util/generate-leaderboard-keyboard";
import { requireAllowedTopic, runGuards } from "../util/guards";
import { parseLeaderboardFilters } from "../util/parse-leaderboard-input";

const composer = new Composer();

composer.command("leaderboard", async (ctx) => {
  const chatId = ctx.chat.id.toString();

  const guard = await runGuards(ctx, [requireAllowedTopic]);
  if (!guard.ok) return ctx.reply(guard.message);

  const { searchKey, timeKey, wordLength } = parseLeaderboardFilters(
    ctx.match,
    ctx.chat.type === "private" ? "global" : undefined,
  );

  const keyboard = generateLeaderboardKeyboard(searchKey, timeKey, wordLength);

  const memberScores = await getLeaderboardScores({
    chatId,
    searchKey,
    timeKey,
    wordLength,
  });

  ctx.reply(formatLeaderboardMessage(memberScores, searchKey), {
    disable_notification: true,
    reply_markup: keyboard,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
});

CommandsHelper.addNewCommand("leaderboard", "View the leaderboard.");

export const leaderboardCommand = composer;
