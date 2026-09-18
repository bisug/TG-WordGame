// Pure Wordle feedback coloring. Kept free of handler/db imports so it can be
// unit-tested directly.

export interface FeedbackGuess {
  guess: string;
}

const GREEN = "🟩";
const YELLOW = "🟨";
const RED = "🟥";

export type LetterStatus = "correct" | "present" | "absent";

// Core two-pass Wordle scoring: exact-position matches first (consuming
// solution letters), then remaining letters marked present only while solution
// letters are still available. This correctly handles duplicate letters, e.g.
// guess "SPEED" vs solution "ERASE" must not over-mark the extra E.
// Case-insensitive. Single source of truth for feedback rows, the share text,
// and the rendered image tiles.
export function scoreGuess(guess: string, solution: string): LetterStatus[] {
  const g = guess.toUpperCase();
  const s = solution.toUpperCase();
  const solutionCount: Record<string, number> = {};

  for (const char of s) {
    solutionCount[char] = (solutionCount[char] || 0) + 1;
  }

  const result: LetterStatus[] = Array(g.length).fill("absent");
  for (let i = 0; i < g.length; i++) {
    const gChar = g[i];
    const sChar = s[i];
    if (gChar && sChar && gChar === sChar) {
      result[i] = "correct";
      solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
    }
  }

  for (let i = 0; i < g.length; i++) {
    const gChar = g[i];
    if (gChar && result[i] === "absent" && (solutionCount[gChar] ?? 0) > 0) {
      result[i] = "present";
      solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
    }
  }

  return result;
}

const STATUS_EMOJI: Record<LetterStatus, string> = {
  correct: GREEN,
  present: YELLOW,
  absent: RED,
};

export function getFeedbackRows(
  data: FeedbackGuess[],
  solution: string,
): string[] {
  return data.map((entry) => {
    const statuses = scoreGuess(entry.guess, solution);
    return `${statuses.map((st) => STATUS_EMOJI[st]).join(" ")} ${entry.guess.toUpperCase()}`;
  });
}

export function getFeedback(data: FeedbackGuess[], solution: string): string {
  return getFeedbackRows(data, solution).join("\n");
}
