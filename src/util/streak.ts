// Pure daily-streak transition logic. Kept free of db imports so it can be
// unit-tested directly.

export interface StreakInput {
  // Game-day string ("YYYY-MM-DD") of the user's last correct guess, or null
  // if they have never won before.
  lastGuessGameDay: string | null;
  currentStreak: number;
  highestStreak: number;
  // Game-day strings for the win being recorded.
  todayGameDay: string;
  yesterdayGameDay: string;
}

export interface StreakResult {
  newStreak: number;
  highestStreak: number;
}

// Compute the streak after a daily win:
// - same game day as last win  -> streak unchanged (already counted today)
// - previous game day          -> streak + 1
// - anything older / never won -> streak resets to 1
export function computeStreakAfterWin(input: StreakInput): StreakResult {
  let newStreak = 1;
  let highestStreak = 1;

  if (input.lastGuessGameDay) {
    if (input.lastGuessGameDay === input.todayGameDay) {
      newStreak = input.currentStreak;
    } else if (input.lastGuessGameDay === input.yesterdayGameDay) {
      newStreak = input.currentStreak + 1;
    } else {
      newStreak = 1;
    }
    highestStreak = Math.max(newStreak, input.highestStreak);
  }

  return { newStreak, highestStreak };
}
