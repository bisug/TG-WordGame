/**
 * Centralized button action constants
 * All callback data should use these constants to ensure consistency
 */

// Help section actions
export const HELP_ACTIONS = {
  HOWTO: "help_howto",
  SCORES: "help_scores",
  GROUP: "help_group",
  OTHER: "help_other",
  ADMIN: "help_admin",
  START: "help_start",
} as const;

// Leaderboard actions
export const LEADERBOARD_ACTIONS = {
  PREFIX: "leaderboard",
  SCORE_PREFIX: "score",
  SCORE_SELECT_PREFIX: "score_select",
  SCORE_LIST_PREFIX: "score_list",
} as const;

// Captcha actions
export const CAPTCHA_ACTIONS = {
  PICK_PREFIX: "captcha_pick",
  BACK: "captcha_back",
  CLEAR: "captcha_clear",
} as const;

// Back button labels
export const BACK_BUTTONS = {
  USER_LIST: "⬅️ Back to user list",
} as const;

// Navigation emojis for buttons
export const NAV_EMOJIS = {
  BACK: "⬅️",
  REFRESH: "🔄",
  CHECK: "✅",
  CROSS: "❌",
} as const;
