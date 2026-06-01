import { describe, expect, test } from "bun:test";

import { formatUserLink, getEndVoteKey, parseEndVoteData } from "./end-vote";

describe("end vote helpers", () => {
  test("scopes vote state by chat and topic", () => {
    expect(getEndVoteKey("-100123", "general")).toBe("vote:-100123:general");
    expect(getEndVoteKey("-100123", "456")).toBe("vote:-100123:456");
  });

  test("parses only valid vote payloads", () => {
    expect(parseEndVoteData('{"voters":["1","2"],"initiatedAt":10}')).toEqual({
      voters: ["1", "2"],
      initiatedAt: 10,
    });
    expect(parseEndVoteData('{"voters":[1],"initiatedAt":10}')).toBeNull();
    expect(parseEndVoteData("{broken")).toBeNull();
    expect(parseEndVoteData(null)).toBeNull();
  });

  test("escapes user names in Telegram HTML links", () => {
    expect(formatUserLink(42, "A <B>", "C & D")).toBe(
      '<a href="tg://user?id=42">A &lt;B&gt; C &amp; D</a>',
    );
  });
});
