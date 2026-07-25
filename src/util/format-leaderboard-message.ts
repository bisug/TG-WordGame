import type { AllowedChatSearchKey, LeaderboardEntry } from "../types";
import { escapeHtmlEntities } from "../util/escape-html-entities";

export function formatLeaderboardMessage(
  data: LeaderboardEntry[],
  searchKey: AllowedChatSearchKey,
) {
  const rankIcons = ["🥇", "🥈", "🥉"] as const;

  const blocks = data.reduce((acc, entry, index) => {
    const rank = rankIcons[index] ?? "🔅";

    let usernameLink = entry.name;
    if (entry.username) {
      usernameLink = `<a href="t.me/${entry.username}">${escapeHtmlEntities(
        entry.name,
      )}</a>`;
    }

    const line = `${rank}${usernameLink} - ${entry.totalScore.toLocaleString()} pts`;

    if (index === 0 || index === 3 || (index > 3 && (index - 3) % 10 === 0)) {
      acc.push([]);
    }

    const currentBlock = acc.at(-1);
    if (currentBlock) currentBlock.push(line);

    return acc;
  }, [] as string[][]);

  const formattedEntries = blocks
    .map((block) => `<blockquote>${block.join("\n")}</blockquote>`)
    .join("\n");

  return `<blockquote>🏆 ${
    searchKey === "global" ? "Global" : "Group"
  } Leaderboard 🏆</blockquote>\n\n${formattedEntries}`;
}
