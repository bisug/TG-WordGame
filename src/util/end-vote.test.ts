import { describe, expect, test } from "bun:test";

import { formatUserLink, getEndVoteKey } from "./end-vote";

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
