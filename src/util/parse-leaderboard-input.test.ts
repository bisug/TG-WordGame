import { describe, expect, test } from "bun:test";

import { parseLeaderboardInput } from "./parse-leaderboard-input";

describe("parseLeaderboardInput", () => {
  test("parses filters, length, and target", () => {
    expect(parseLeaderboardInput("global week 6 @bob")).toEqual({
      searchKey: "global",
      timeKey: "week",
      wordLength: 6,
      target: "@bob",
    });
  });

  test("first positional token becomes target", () => {
    expect(parseLeaderboardInput("bob month").target).toBe("bob");
  });

  test("repeated tokens do not clobber the target", () => {
    expect(parseLeaderboardInput("bob month bob").target).toBe("bob");
  });

  test("invalid word length is ignored", () => {
    expect(parseLeaderboardInput("7 @bob").wordLength).toBeUndefined();
  });

  test("handles extra whitespace and case", () => {
    expect(parseLeaderboardInput("  GLOBAL   Week ")).toEqual({
      searchKey: "global",
      timeKey: "week",
      wordLength: undefined,
      target: undefined,
    });
  });
});
