import { expect, test } from "bun:test";

import { richToPlainHtml, supportsRichMessages } from "./rich-message";

test("rich messages are enabled only for the official API root", () => {
  expect(supportsRichMessages("https://api.telegram.org")).toBe(true);
  expect(supportsRichMessages("https://api.telegram.org/")).toBe(true);
  expect(supportsRichMessages("https://local-bot-api:8081")).toBe(false);
});

test("fallback keeps colors and removes rich-only tags", () => {
  const rich =
    '<h3>How to Play</h3><p><tg-button-row align="center">' +
    '<tg-button style="success" data="wh:correct:S">S</tg-button>' +
    '<tg-button data="wh:present:T">T</tg-button></tg-button-row></p>' +
    "<table bordered compact><tr><th>Command</th><td>/new</td></tr></table>" +
    "<blockquote expandable><p>Daily mode</p><ul><li>One word per day</li></ul></blockquote>" +
    "<hr/><footer>Fork notice</footer>";
  const plain = richToPlainHtml(rich);

  expect(plain).toContain("🟩S");
  expect(plain).toContain("🟨T");
  expect(plain).toContain("• One word per day");
  expect(plain).toMatch(/<blockquote>\s*Daily mode/);
  expect(plain).toContain("Fork notice");
  expect(plain).not.toMatch(
    /<(?:h3|h4|p|li|ul|ol|table|tr|th|td|footer|tg-button|tg-button-row)\b/,
  );
  expect(plain).not.toContain("expandable");
});
