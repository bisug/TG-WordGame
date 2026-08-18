// Pure Wordle feedback coloring. Kept free of handler/db imports so it can be
// unit-tested directly.

export interface FeedbackGuess {
  guess: string;
}

const GREEN = "🟩";
const YELLOW = "🟨";
const RED = "🟥";

// Two-pass Wordle coloring: exact-position matches first (consuming solution
// letters), then remaining letters marked present only while solution letters
// are still available. This correctly handles duplicate letters, e.g.
// guess "SPEED" vs solution "ERASE" must not over-mark the extra E.
export function getFeedbackRows(
  data: FeedbackGuess[],
  solution: string,
): string[] {
  return data.map((entry) => {
    const guess = entry.guess.toUpperCase();
    const solutionCount: Record<string, number> = {};

    for (const char of solution.toUpperCase()) {
      solutionCount[char] = (solutionCount[char] || 0) + 1;
    }

    const result = Array(guess.length).fill(RED);
    for (let i = 0; i < guess.length; i++) {
      const gChar = guess[i];
      const sChar = solution[i]?.toUpperCase();
      if (gChar && sChar && gChar === sChar) {
        result[i] = GREEN;
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      }
    }

    for (let i = 0; i < guess.length; i++) {
      const gChar = guess[i];
      if (gChar && result[i] === RED && (solutionCount[gChar] ?? 0) > 0) {
        result[i] = YELLOW;
        solutionCount[gChar] = (solutionCount[gChar] ?? 0) - 1;
      }
    }

    return `${result.join(" ")} ${guess}`;
  });
}

export function getFeedback(data: FeedbackGuess[], solution: string): string {
  return getFeedbackRows(data, solution).join("\n");
}
