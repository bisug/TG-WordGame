import {
  type AllowedWordLength,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
  allowedWordLengths,
} from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";

type ParseResult = {
  searchKey: AllowedChatSearchKey | undefined;
  timeKey: AllowedChatTimeKey | undefined;
  wordLength: AllowedWordLength | undefined;
  target: string | undefined;
};

export function parseLeaderboardInput(
  input: string,
  defaultSearchKey?: AllowedChatSearchKey,
  defaultTimeKey?: AllowedChatTimeKey | null,
): ParseResult {
  const parts = input.toLowerCase().trim().split(/\s+/).filter(Boolean);

  let target: string | undefined;
  let foundSearchKey: AllowedChatSearchKey | undefined;
  let foundTimeKey: AllowedChatTimeKey | undefined;
  let foundWordLength: AllowedWordLength | undefined;

  for (const [index, part] of parts.entries()) {
    if (allowedChatSearchKeys.includes(part as AllowedChatSearchKey)) {
      foundSearchKey = part as AllowedChatSearchKey;
      continue;
    }

    if (allowedChatTimeKeys.includes(part as AllowedChatTimeKey)) {
      foundTimeKey = part as AllowedChatTimeKey;
      continue;
    }

    if (allowedWordLengths.includes(Number(part) as AllowedWordLength)) {
      foundWordLength = Number(part) as AllowedWordLength;
      continue;
    }

    if (part.startsWith("@") || /^\d+$/.test(part)) {
      target = part;
      continue;
    }

    // Use the loop index, not parts.indexOf(part): indexOf returns the FIRST
    // occurrence, so a repeated first token (e.g. "5 bob 5") would be
    // misidentified as position 0 and overwrite the target.
    if (!target && index === 0) {
      target = part;
    }
  }

  const searchKey = foundSearchKey || defaultSearchKey;
  const timeKey =
    foundTimeKey || (defaultTimeKey === null ? undefined : defaultTimeKey);
  // `undefined` means "no length requested" so callers can fall back to a
  // smart default (e.g. the user's most-played length) instead of always 5.
  const wordLength = foundWordLength;

  return { searchKey, timeKey, wordLength, target };
}

// Same tokenizer, same accepted keys, same defaults — so it delegates to the
// parser above instead of re-scanning the input a second time. One deliberate
// behavior change: repeated filters now resolve to the last occurrence, matching
// parseLeaderboardInput (a CLI-style "later overrides earlier"). The previous
// Array.find scan made the first occurrence win, so `/leaderboard week month`
// picked "week" while `/score week month` picked "month". Only input that names
// the same field twice is affected; single-value input is identical.
export function parseLeaderboardFilters(
  input: string,
  defaultSearchKey: AllowedChatSearchKey = "group",
  defaultTimeKey: AllowedChatTimeKey = "month",
) {
  const { searchKey, timeKey, wordLength } = parseLeaderboardInput(
    input,
    defaultSearchKey,
    defaultTimeKey,
  );

  return {
    searchKey: searchKey as AllowedChatSearchKey,
    timeKey: timeKey as AllowedChatTimeKey,
    wordLength: wordLength ?? 5,
  };
}
