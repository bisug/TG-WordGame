import { InlineKeyboard } from "grammy";

import {
  type AllowedWordLength,
  allowedChatSearchKeys,
  allowedChatTimeKeys,
  DISCUSSION_GROUP,
  DONATION_LINK,
  UPDATES_CHANNEL,
} from "../config/constants";
import type { AllowedChatSearchKey, AllowedChatTimeKey } from "../types";
import { BACK_BUTTONS, NAV_EMOJIS } from "./button-actions";
import { formatActiveButton } from "./button-helpers";

const allowedWordLengths: AllowedWordLength[] = [4, 5, 6];

export function generateLeaderboardKeyboard(
  searchKey: AllowedChatSearchKey,
  timeKey: AllowedChatTimeKey,
  wordLength: AllowedWordLength = 5,
  callbackKey: "leaderboard" | `score ${string | number}` = "leaderboard",
  backButton?: { text: string; callback: string },
) {
  const keyboard = new InlineKeyboard();
  const mid = Math.floor(allowedChatSearchKeys.length / 2);

  allowedChatSearchKeys.forEach((key, index) => {
    if (index === mid) {
      keyboard.text(
        NAV_EMOJIS.REFRESH,
        `${callbackKey} ${searchKey} ${timeKey} ${wordLength}`,
      );
    }

    keyboard
      .text(
        formatActiveButton(
          key === "group" ? "This chat" : "Global",
          searchKey === key,
        ),
        `${callbackKey} ${key} ${timeKey} ${wordLength}`,
      )
      .style(searchKey === key ? "primary" : undefined);
  });

  keyboard.row();

  allowedChatTimeKeys.forEach((key, index) => {
    keyboard
      .text(
        formatActiveButton(
          key === "all"
            ? "All time"
            : key === "today"
              ? "Today"
              : `This ${key}`,
          timeKey === key,
        ),
        `${callbackKey} ${searchKey} ${key} ${wordLength}`,
      )
      .style(timeKey === key ? "primary" : undefined);

    if ((index + 1) % 3 === 0) keyboard.row();
  });

  keyboard.row();

  allowedWordLengths.forEach((len) => {
    keyboard
      .text(
        formatActiveButton(`${len} letters`, wordLength === len),
        `${callbackKey} ${searchKey} ${timeKey} ${len}`,
      )
      .style(wordLength === len ? "primary" : undefined);
  });

  keyboard.row();
  keyboard.url("📢 Updates", UPDATES_CHANNEL);
  keyboard.url("💓 Donate", DONATION_LINK).success();
  keyboard.url("💬 Discussion", DISCUSSION_GROUP);

  if (backButton) {
    keyboard.row();
    keyboard.text(backButton.text, backButton.callback);
  }

  return keyboard;
}
