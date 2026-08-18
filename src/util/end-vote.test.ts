import { describe, expect, test } from "bun:test";

import { formatUserLink, getEndVoteKey, getEndVoteThreshold } from "./end-vote";

describe("end vote helpers", () => {
  test("scopes vote state by chat and topic", () => {
    expect(getEndVoteKey("-100123", "general")).toBe("vote:-100123:general");
    expect(getEndVoteKey("-100123", "456")).toBe("vote:-100123:456");
  });

  test("escapes user names in Telegram HTML links", () => {
    expect(formatUserLink(42, "A <B>", "C & D")).toBe(
      '<a href="tg://user?id=42">A &lt;B&gt; C &amp; D</a>',
    );
  });
});

describe("getEndVoteThreshold", () => {
  test("unknown player count falls back to legacy 3", () => {
    expect(getEndVoteThreshold(0)).toBe(3);
    expect(getEndVoteThreshold(-1)).toBe(3);
  });

  test("single player needs only 1 vote", () => {
    expect(getEndVoteThreshold(1)).toBe(1);
  });

  test("two players need 2 votes (strict majority)", () => {
    expect(getEndVoteThreshold(2)).toBe(2);
  });

  test("three players need 2 votes, four need 3", () => {
    expect(getEndVoteThreshold(3)).toBe(2);
    expect(getEndVoteThreshold(4)).toBe(3);
  });

  test("large groups are capped at 3", () => {
    expect(getEndVoteThreshold(5)).toBe(3);
    expect(getEndVoteThreshold(100)).toBe(3);
  });
});
