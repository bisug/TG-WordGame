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

// Ban/unban actions
export const BAN_ACTIONS = {
  CONFIRM: "ban_confirm",
  CANCEL: "ban_cancel",
} as const;

// Game actions
export const GAME_ACTIONS = {
  END_VOTE: "end_vote",
  END_CONFIRM: "end_confirm",
} as const;

// Back button labels
export const BACK_BUTTONS = {
  MAIN_HELP: "⬅️ Back to Main Help",
  USER_LIST: "⬅️ Back to user list",
  LEADERBOARD: "⬅️ Back to Leaderboard",
} as const;

// Navigation emojis for buttons
export const NAV_EMOJIS = {
  BACK: "⬅️",
  REFRESH: "🔄",
  CHECK: "✅",
  CROSS: "❌",
} as const;