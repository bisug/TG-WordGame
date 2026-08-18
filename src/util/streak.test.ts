import { describe, expect, test } from "bun:test";
import { computeStreakAfterWin } from "./streak";

const TODAY = "2026-07-11";
const YESTERDAY = "2026-07-10";

describe("computeStreakAfterWin", () => {
  test("first-ever win starts streak at 1", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: null,
      currentStreak: 0,
      highestStreak: 0,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 1, highestStreak: 1 });
  });

  test("win on consecutive game day increments streak", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: YESTERDAY,
      currentStreak: 3,
      highestStreak: 5,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 4, highestStreak: 5 });
  });

  test("second win on same game day keeps streak unchanged", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: TODAY,
      currentStreak: 4,
      highestStreak: 4,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 4, highestStreak: 4 });
  });

  test("win after a gap resets streak to 1", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: "2026-07-08",
      currentStreak: 7,
      highestStreak: 7,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 1, highestStreak: 7 });
  });

  test("new streak beating record updates highestStreak", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: YESTERDAY,
      currentStreak: 5,
      highestStreak: 5,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 6, highestStreak: 6 });
  });

  test("same-day win never lowers highestStreak", () => {
    const result = computeStreakAfterWin({
      lastGuessGameDay: TODAY,
      currentStreak: 2,
      highestStreak: 9,
      todayGameDay: TODAY,
      yesterdayGameDay: YESTERDAY,
    });
    expect(result).toEqual({ newStreak: 2, highestStreak: 9 });
  });
});
